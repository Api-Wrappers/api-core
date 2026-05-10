import type { RequestContext } from "../context/RequestContext";
import { TimeoutError } from "../errors/TimeoutError";
import { buildUrl } from "../utils/buildUrl";
import { isPlainObject } from "../utils/isPlainObject";
import type { Transport } from "./types";

const defaultFetch: typeof globalThis.fetch = (input, init) => {
	return globalThis.fetch(input, init);
};

/**
 * Creates a {@link Transport} backed by the provided `fetch` function.
 * Use this when you need a polyfill or a custom fetch interceptor:
 *
 * ```ts
 * import nodeFetch from "node-fetch";
 * createClient({ fetch: nodeFetch as typeof globalThis.fetch });
 * // — or set it directly on the transport:
 * const transport = createFetchTransport(nodeFetch as typeof globalThis.fetch);
 * ```
 */
export function createFetchTransport(
	fetchFn: typeof globalThis.fetch = defaultFetch,
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

	const contentType = headers["content-type"] ?? "";
	if (
		isPlainObject(body) ||
		Array.isArray(body) ||
		contentType.includes("json")
	) {
		return JSON.stringify(body);
	}

	return String(body);
}

function isBodyInit(body: unknown): body is BodyInit {
	if (typeof body === "string") return true;
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
