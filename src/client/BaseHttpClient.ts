import type { RequestContext } from "../context/RequestContext";
import type { ResponseContext } from "../context/ResponseContext";
import { ApiError } from "../errors/ApiError";
import { RateLimitError } from "../errors/RateLimitError";
import { GraphQLRequestError } from "../graphql/GraphQLRequestError";
import type { GraphQLRequestOptions, GraphQLResponse } from "../graphql/types";
import { getPluginErrorContext, PluginManager } from "../plugin/PluginManager";
import { readRetryMeta } from "../plugins/meta";
import {
	createFetchTransport,
	fetchTransport,
} from "../transport/fetchTransport";
import type { Transport } from "../transport/types";
import type { HeaderInput, HttpMethod, QueryParams } from "../types/common";
import { isJsonContentType } from "../utils/isJsonContentType";
import { mergeHeaders } from "../utils/mergeHeaders";
import { normalizeRetryMaxAttempts } from "../utils/normalizeRetryMaxAttempts";
import { resolveUrl } from "../utils/resolveUrl";
import { sleep } from "../utils/sleep";
import type { ClientConfig } from "./types";

/** Per-request options passed to {@link BaseHttpClient.request} and the convenience methods. */
export type ResponseType = "auto" | "json" | "text" | "arrayBuffer" | "blob";

export interface RequestOptions {
	/** HTTP method. Defaults to `"GET"`. */
	method?: HttpMethod;
	/**
	 * Additional headers merged on top of `ClientConfig.defaultHeaders`.
	 * These take precedence; `content-type: application/json` is always
	 * present and is the lowest-priority default.
	 */
	headers?: HeaderInput;
	/** Request body. Serialised to JSON by {@link fetchTransport}. Ignored for GET and HEAD. */
	body?: unknown;
	/**
	 * Query string parameters appended to the URL. `undefined` values are
	 * omitted. Numbers and booleans are coerced to strings. Array values are
	 * emitted as repeated query parameters.
	 */
	query?: QueryParams;
	/** Optional caller-provided abort signal. Composes with `timeoutMs`. */
	signal?: AbortSignal;
	/**
	 * Per-request timeout override in milliseconds. Takes precedence over
	 * `ClientConfig.timeoutMs`. Throws {@link TimeoutError} when exceeded.
	 */
	timeoutMs?: number;
	/**
	 * Explicit cache key used by {@link createCachePlugin}. When omitted the
	 * plugin derives a key from the method, URL, and query string.
	 */
	cacheKey?: string;
	/**
	 * Arbitrary string tags attached to the request context. Plugins may use
	 * these for cache invalidation, metrics grouping, or filtering.
	 */
	tags?: string[];
	/**
	 * Controls how the response body is parsed. Defaults to content-type based
	 * parsing: JSON responses become objects, everything else becomes text.
	 */
	responseType?: ResponseType;
	/**
	 * Optional response parser for non-2xx bodies. Defaults to `"auto"` so APIs
	 * that return binary success payloads can still surface text/JSON errors.
	 */
	errorResponseType?: ResponseType;
}

export interface ApiResponse<T = unknown> {
	data: T;
	response: Response;
	request: RequestContext;
	meta: Record<string, unknown>;
}

const DEFAULT_RETRIABLE_STATUS_CODES = [429, 500, 502, 503, 504];

interface RetryPolicy {
	maxAttempts: number;
	baseDelay: number;
	jitter: boolean;
	retriableCodes: readonly number[];
}

class TransportExecutionError {
	constructor(readonly cause: unknown) {}
}

/**
 * Core HTTP client. Manages the plugin lifecycle, retry loop, and transport
 * dispatch for all requests.
 *
 * Plugins are initialised lazily on the first call to {@link request} (or any
 * convenience method). Call {@link dispose} when the client is no longer
 * needed so plugins can release timers, connections, or cache handles.
 *
 * Extend this class to add domain-specific methods while keeping the plugin
 * and transport infrastructure intact.
 *
 * @example
 * ```ts
 * // Prefer createClient() in application code:
 * const client = createClient({ baseUrl: "https://api.example.com/v1" });
 *
 * // Or subclass for wrapper packages:
 * class MyApiClient extends BaseHttpClient {
 *   getUser(id: string) { return this.get<User>(`/users/${id}`); }
 * }
 * ```
 */
export class BaseHttpClient {
	protected readonly config: ClientConfig;
	protected readonly pluginManager: PluginManager;
	private initialized = false;
	private initPromise: Promise<void> | undefined;

	constructor(config: ClientConfig) {
		this.config = config;
		this.pluginManager = new PluginManager(config.logger);
		for (const plugin of config.plugins ?? []) {
			this.pluginManager.register(plugin);
		}
	}

	/** Initializes all plugins. Called lazily on first request. */
	async init(): Promise<void> {
		if (this.initialized) return;
		this.initPromise ??= this.pluginManager
			.setup(this)
			.then(() => {
				this.initialized = true;
			})
			.catch((err) => {
				this.initPromise = undefined;
				throw err;
			});
		await this.initPromise;
	}

	/** Disposes all plugins. Call when the client is no longer needed. */
	async dispose(): Promise<void> {
		await this.pluginManager.dispose();
		this.initialized = false;
		this.initPromise = undefined;
	}

	/**
	 * Executes an HTTP request through the full plugin pipeline.
	 *
	 * Lifecycle per attempt:
	 * 1. Build `RequestContext` with merged headers, query, and retry state.
	 * 2. Run `beforeRequest` hooks (ascending priority). A plugin may set
	 *    `ctx.syntheticResponse` to skip the transport entirely (e.g. cache hit).
	 * 3. Merge any `retry.*` meta written by {@link createRetryPlugin}.
	 * 4. Call transport (skipped when `syntheticResponse` is set).
	 * 5. Parse the response body (JSON or text).
	 * 6. Run `afterResponse` hooks (descending priority).
	 * 7. Retry on retriable status codes; throw on terminal failures.
	 *
	 * @param path - Path appended to `ClientConfig.baseUrl`. Should start with `/`.
	 * @param options - Per-request overrides for method, headers, body, query, etc.
	 * @returns The parsed response body cast to `T`.
	 * @throws {@link ApiError} for non-2xx responses.
	 * @throws {@link RateLimitError} for 429 responses.
	 * @throws {@link TimeoutError} when `timeoutMs` is exceeded.
	 */
	async request<T = unknown>(
		path: string,
		options: RequestOptions = {},
	): Promise<T> {
		const result = await this.requestWithResponse<T>(path, options);
		return result.data;
	}

	/**
	 * Executes a request and returns the parsed body plus the final response
	 * context. Use this in wrappers that need response headers, status, or
	 * plugin metadata while keeping the same error/retry behaviour as
	 * {@link request}.
	 */
	async requestWithResponse<T = unknown>(
		path: string,
		options: RequestOptions = {},
	): Promise<ApiResponse<T>> {
		await this.init();

		const transport = this.resolveTransport();
		let retryPolicy = this.resolveInitialRetryPolicy();
		let lastError: unknown;

		for (let attempt = 0; attempt < retryPolicy.maxAttempts; attempt++) {
			const baseCtx = this.buildRequestContext(
				path,
				options,
				attempt,
				retryPolicy,
			);
			const ctx = await this.runBeforeRequest(baseCtx);
			retryPolicy = this.resolveRetryPolicyFromMeta(ctx, retryPolicy);

			const retryCount = retryPolicy.maxAttempts - 1 - attempt;
			const attemptCtx =
				ctx.retryCount === retryCount ? ctx : { ...ctx, retryCount };

			let resCtx: ResponseContext;
			try {
				resCtx = await this.executeAttempt(attemptCtx, transport, options);
			} catch (err) {
				if (!(err instanceof TransportExecutionError)) {
					throw err;
				}

				lastError = err.cause;
				if (attempt < retryPolicy.maxAttempts - 1) {
					await this.waitForRetry(
						attempt,
						retryPolicy.baseDelay,
						retryPolicy.jitter,
					);
					continue;
				}
				throw err.cause;
			}

			const finalResponse = resCtx.response;

			if (!finalResponse.ok) {
				const shouldRetry =
					retryPolicy.retriableCodes.includes(finalResponse.status) &&
					attempt < retryPolicy.maxAttempts - 1;

				if (shouldRetry) {
					if (finalResponse.status === 429) {
						const wait = readRetryAfterMs(finalResponse);
						await this.waitForRetry(
							attempt,
							wait ?? retryPolicy.baseDelay,
							false,
						);
					} else {
						await this.waitForRetry(
							attempt,
							retryPolicy.baseDelay,
							retryPolicy.jitter,
						);
					}
					lastError = normalizeHttpError(finalResponse, resCtx.parsedBody);
					continue;
				}

				const err = normalizeHttpError(finalResponse, resCtx.parsedBody);
				await this.pluginManager.onError(err, ctx);
				throw err;
			}

			return {
				data: resCtx.parsedBody as T,
				response: resCtx.response,
				request: resCtx.request,
				meta: resCtx.meta,
			};
		}

		throw lastError;
	}

	private resolveTransport(): Transport {
		return (
			this.config.transport ??
			(this.config.fetch
				? createFetchTransport(this.config.fetch)
				: fetchTransport)
		);
	}

	private resolveInitialRetryPolicy(): RetryPolicy {
		const retryCfg = this.config.retry;
		return {
			maxAttempts: normalizeRetryMaxAttempts(retryCfg?.maxAttempts),
			baseDelay: retryCfg?.delayMs ?? 500,
			jitter: retryCfg?.jitter ?? true,
			retriableCodes:
				retryCfg?.retriableStatusCodes ?? DEFAULT_RETRIABLE_STATUS_CODES,
		};
	}

	private buildRequestContext(
		path: string,
		options: RequestOptions,
		attempt: number,
		retryPolicy: RetryPolicy,
	): RequestContext {
		return {
			url: resolveUrl(this.config.baseUrl, path),
			method: options.method ?? "GET",
			headers: mergeHeaders(
				{ "content-type": "application/json" },
				this.config.defaultHeaders,
				options.headers,
			),
			body: options.body,
			query: options.query,
			signal: options.signal,
			meta: {},
			cacheKey: options.cacheKey,
			tags: options.tags,
			retryCount: retryPolicy.maxAttempts - 1 - attempt,
			attempt,
			timeoutMs: options.timeoutMs ?? this.config.timeoutMs,
		};
	}

	private async runBeforeRequest(
		baseCtx: RequestContext,
	): Promise<RequestContext> {
		try {
			return await this.pluginManager.beforeRequest(baseCtx);
		} catch (err) {
			await this.pluginManager.onError(
				err,
				getPluginErrorContext(err) ?? baseCtx,
			);
			throw err;
		}
	}

	private resolveRetryPolicyFromMeta(
		ctx: RequestContext,
		current: RetryPolicy,
	): RetryPolicy {
		const retryMeta = readRetryMeta(ctx.meta);
		return {
			maxAttempts:
				retryMeta.maxAttempts === undefined
					? current.maxAttempts
					: normalizeRetryMaxAttempts(retryMeta.maxAttempts),
			baseDelay: retryMeta.delayMs ?? current.baseDelay,
			jitter: retryMeta.jitter ?? current.jitter,
			retriableCodes: retryMeta.retriableStatusCodes ?? current.retriableCodes,
		};
	}

	private async executeAttempt(
		ctx: RequestContext,
		transport: Transport,
		options: RequestOptions,
	): Promise<ResponseContext> {
		let rawResponse: Response;
		if (ctx.syntheticResponse) {
			// A plugin (e.g. cache) pre-populated the response — skip the
			// network entirely.
			rawResponse = ctx.syntheticResponse;
		} else {
			try {
				rawResponse = await transport.execute(ctx);
			} catch (err) {
				await this.pluginManager.onError(err, ctx);
				throw new TransportExecutionError(err);
			}
		}

		const parsedBody = await parseBody(
			rawResponse,
			rawResponse.ok
				? options.responseType
				: (options.errorResponseType ?? "auto"),
		);

		const resCtx: ResponseContext = {
			request: ctx,
			response: rawResponse,
			parsedBody,
			meta: {},
		};

		try {
			return await this.pluginManager.afterResponse(resCtx);
		} catch (err) {
			await this.pluginManager.onError(err, ctx);
			throw err;
		}
	}

	// ─── Convenience methods ────────────────────────────────────────────────────
	// Each method is a thin wrapper around request() that fixes the HTTP verb.

	/** Sends a GET request. The response body is not cached unless a cache plugin is registered. */
	get<T = unknown>(
		path: string,
		options?: Omit<RequestOptions, "method">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "GET" });
	}

	post<T = unknown>(
		path: string,
		body?: unknown,
		options?: Omit<RequestOptions, "method" | "body">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "POST", body });
	}

	put<T = unknown>(
		path: string,
		body?: unknown,
		options?: Omit<RequestOptions, "method" | "body">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "PUT", body });
	}

	patch<T = unknown>(
		path: string,
		body?: unknown,
		options?: Omit<RequestOptions, "method" | "body">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "PATCH", body });
	}

	delete<T = unknown>(
		path: string,
		options?: Omit<RequestOptions, "method">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "DELETE" });
	}

	head<T = unknown>(
		path: string,
		options?: Omit<RequestOptions, "method">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "HEAD" });
	}

	options<T = unknown>(
		path: string,
		options?: Omit<RequestOptions, "method">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "OPTIONS" });
	}

	/**
	 * Executes a GraphQL query or mutation against a single endpoint path.
	 *
	 * The request is a `POST` with `content-type: application/json` carrying
	 * `{ query, variables?, operationName? }` as the body. It flows through
	 * the full plugin lifecycle (beforeRequest → transport → afterResponse →
	 * onError) and respects all retry configuration, exactly like REST calls.
	 *
	 * **Error handling:**
	 * - HTTP-level failures (429, 500, timeout) throw the same error classes
	 *   as REST requests (`RateLimitError`, `ApiError`, `TimeoutError`).
	 * - A successful HTTP 200 that contains a non-empty `errors` array throws
	 *   {@link GraphQLRequestError}, which extends `ApiError`.
	 *
	 * **Caching:**
	 * The cache plugin skips `POST` requests by default. Pass an explicit
	 * `cacheKey` in options to opt a specific operation into caching.
	 *
	 * @typeParam TData - Shape of the `data` field in the GraphQL response.
	 * @typeParam TVariables - Shape of the `variables` object. Defaults to
	 *   `Record<string, unknown>`.
	 * @param path - Endpoint path, e.g. `"/graphql"`. Appended to `baseUrl`.
	 * @param options - Query document, variables, and optional per-request overrides.
	 * @returns The `data` field from the GraphQL response envelope.
	 * @throws {@link GraphQLRequestError} when `response.errors` is non-empty.
	 * @throws {@link ApiError} / {@link RateLimitError} / {@link TimeoutError} on
	 *   HTTP-level failures.
	 *
	 * @example
	 * ```ts
	 * const data = await client.graphql<GetUserQuery, GetUserQueryVariables>(
	 *   "/graphql",
	 *   { query: GET_USER, variables: { id: "123" } },
	 * );
	 * ```
	 */
	async graphql<
		TData = unknown,
		TVariables extends object = Record<string, unknown>,
	>(path: string, options: GraphQLRequestOptions<TVariables>): Promise<TData> {
		const {
			query,
			variables,
			operationName,
			headers,
			signal,
			timeoutMs,
			cacheKey,
			tags,
		} = options;

		const envelope = await this.request<GraphQLResponse<TData>>(path, {
			method: "POST",
			body: {
				query,
				...(variables !== undefined && { variables }),
				...(operationName !== undefined && { operationName }),
			},
			headers: mergeHeaders(headers, { "content-type": "application/json" }),
			signal,
			timeoutMs,
			cacheKey,
			tags,
		});

		// Surface GraphQL application-layer errors as a typed exception.
		// We throw even when partial data is present — callers who need
		// partial results can catch GraphQLRequestError and read .partialData.
		if (envelope.errors && envelope.errors.length > 0) {
			throw new GraphQLRequestError(envelope.errors, envelope.data);
		}

		// data may be undefined if the server returned an empty response —
		// safe to cast because TData defaults to unknown.
		return envelope.data as TData;
	}

	private async waitForRetry(
		attempt: number,
		baseDelay: number,
		useJitter: boolean,
	): Promise<void> {
		// Exponential backoff: delay * 2^attempt
		const exponential = baseDelay * 2 ** attempt;
		const ms = useJitter
			? exponential * (0.5 + Math.random() * 0.5)
			: exponential;
		await sleep(Math.round(ms));
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function parseBody(
	response: Response,
	responseType: ResponseType = "auto",
): Promise<unknown> {
	if (responseType === "arrayBuffer") return response.arrayBuffer();
	if (responseType === "blob") return response.blob();

	if (response.status === 204 || response.status === 205) return undefined;
	if (response.headers.get("content-length") === "0") return undefined;

	const text = await response.text();
	if (responseType === "text") return text;
	if (!text) return undefined;

	if (responseType === "json") return JSON.parse(text);

	if (isJsonContentType(response.headers.get("content-type"))) {
		return JSON.parse(text);
	}
	return text;
}

function normalizeHttpError(response: Response, body: unknown): ApiError {
	if (response.status === 429) {
		return new RateLimitError(readRetryAfterMs(response), body);
	}
	return new ApiError(
		`Request failed with status ${response.status}`,
		response.status,
		body,
	);
}

function readRetryAfterMs(response: Response): number | undefined {
	const raw = response.headers.get("retry-after");
	if (!raw) return undefined;

	const seconds = Number(raw);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

	const date = Date.parse(raw);
	if (!Number.isNaN(date)) return Math.max(0, date - Date.now());

	return undefined;
}
