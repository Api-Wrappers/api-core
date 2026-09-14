import type { RequestContext } from "../context/RequestContext";
import { TimeoutError } from "../errors/TimeoutError";
import { buildUrl } from "../utils/buildUrl";
import { isJsonContentType } from "../utils/isJsonContentType";
import { isPlainObject } from "../utils/isPlainObject";
import type { FetchLike, Transport } from "./types";

const defaultFetch: FetchLike = (input, init) => {
	return globalThis.fetch(input, init);
};

/**
 * Creates a {@link Transport} backed by the provided `fetch` function.
 * Use this when you need a polyfill or a custom fetch interceptor:
 *
 * ```ts
 * import nodeFetch from "node-fetch";
 * createClient({ fetch: nodeFetch as FetchLike });
 * // — or set it directly on the transport:
 * const transport = createFetchTransport(nodeFetch as FetchLike);
 * ```
 */
export function createFetchTransport(
	fetchFn: FetchLike = defaultFetch,
): Transport {
	return {
		async execute(ctx: RequestContext): Promise<Response> {
			const url = buildUrl(ctx.url, ctx.query);
			const init: RequestInit = {
				method: ctx.method,
				headers: ctx.headers,
			};

			const hasBody =
				ctx.body !== undefined && ctx.method !== "GET" && ctx.method !== "HEAD";

			if (hasBody) {
				init.body = serializeRequestBody(ctx.body, ctx.headers);

				// Multipart and binary bodies must not advertise a JSON content
				// type. Strip a defaulted one so `fetch` can supply the correct
				// value, including the multipart boundary.
				if (
					bodyHasOwnContentType(ctx.body) &&
					isJsonContentType(ctx.headers["content-type"])
				) {
					const headers = { ...ctx.headers };
					delete headers["content-type"];
					init.headers = headers;
				}
			}

			if (ctx.timeoutMs !== undefined || ctx.signal) {
				const controller = new AbortController();
				let timedOut = false;
				const abortFromParent = () => controller.abort(ctx.signal?.reason);
				const timer =
					ctx.timeoutMs !== undefined
						? setTimeout(() => {
								timedOut = true;
								controller.abort();
							}, ctx.timeoutMs)
						: undefined;

				if (ctx.signal) {
					if (ctx.signal.aborted) {
						controller.abort(ctx.signal.reason);
					} else {
						ctx.signal.addEventListener("abort", abortFromParent, {
							once: true,
						});
					}
				}

				try {
					return await fetchFn(url, { ...init, signal: controller.signal });
				} catch (err) {
					if (timedOut && err instanceof Error && err.name === "AbortError") {
						throw new TimeoutError(
							`Request timed out after ${ctx.timeoutMs}ms`,
							err,
						);
					}
					throw err;
				} finally {
					if (timer) clearTimeout(timer);
					ctx.signal?.removeEventListener("abort", abortFromParent);
				}
			}

			return fetchFn(url, init);
		},
	};
}

/**
 * Default {@link Transport} backed by the global `fetch` API.
 *
 * Behaviour:
 * - Builds the final URL from `ctx.url` + `ctx.query` via {@link buildUrl}.
 * - Serialises `ctx.body` to JSON for non-GET/HEAD requests.
 * - Wires an `AbortController` when `ctx.timeoutMs` is set; throws
 *   {@link TimeoutError} on abort.
 *
 * Replace this with a custom {@link Transport} in tests, or provide a custom
 * `fetch` function via {@link ClientConfig.fetch}.
 */
export const fetchTransport: Transport = createFetchTransport();

function serializeRequestBody(
	body: unknown,
	headers: Record<string, string>,
): BodyInit {
	if (isBodyInit(body)) return body;

	if (
		isPlainObject(body) ||
		Array.isArray(body) ||
		isJsonContentType(headers["content-type"])
	) {
		return JSON.stringify(body);
	}

	return String(body);
}

function isBodyInit(body: unknown): body is BodyInit {
	if (typeof body === "string") return true;
	return bodyHasOwnContentType(body);
}

/**
 * Body types whose content type is defined by the body itself — multipart
 * boundaries, URL-encoded forms, blobs, and binary buffers. Callers (or
 * `fetch`) must supply the matching `content-type`; api-core should not
 * default these bodies to `application/json`.
 */
export function bodyHasOwnContentType(body: unknown): boolean {
	if (body instanceof ArrayBuffer) return true;
	if (ArrayBuffer.isView(body)) return true;
	if (typeof Blob !== "undefined" && body instanceof Blob) return true;
	if (typeof FormData !== "undefined" && body instanceof FormData) return true;
	if (
		typeof URLSearchParams !== "undefined" &&
		body instanceof URLSearchParams
	) {
		return true;
	}
	if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
		return true;
	}
	return false;
}
