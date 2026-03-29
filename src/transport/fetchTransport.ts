import type { RequestContext } from "../context/RequestContext";
import { TimeoutError } from "../errors/TimeoutError";
import { buildUrl } from "../utils/buildUrl";
import type { Transport } from "./types";

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
	fetchFn: typeof globalThis.fetch = globalThis.fetch,
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
				init.body = JSON.stringify(ctx.body);
			}

			if (ctx.timeoutMs !== undefined) {
				const controller = new AbortController();
				const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
				try {
					return await fetchFn(url, { ...init, signal: controller.signal });
				} catch (err) {
					if (err instanceof Error && err.name === "AbortError") {
						throw new TimeoutError(
							`Request timed out after ${ctx.timeoutMs}ms`,
							err,
						);
					}
					throw err;
				} finally {
					clearTimeout(timer);
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
