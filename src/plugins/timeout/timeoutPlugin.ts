import type { ApiPlugin } from "../../plugin/types";
import type { TimeoutPluginOptions } from "./types";

/**
 * Sets `ctx.timeoutMs` on every request so all requests made by this client
 * abort after the configured duration. The actual abort and
 * {@link TimeoutError} are handled by {@link fetchTransport}.
 *
 * Priority `1` ensures the timeout is stamped before any other plugin (e.g.
 * logger, cache) runs — plugins that read `ctx.timeoutMs` will always see it.
 * Use a `beforeRequest` hook with a lower priority to override per-request.
 *
 * Prefer `ClientConfig.timeoutMs` for a static global timeout. Use this
 * plugin when you need to set or change the timeout through the plugin
 * pipeline (e.g. from environment config loaded asynchronously in `setup`).
 *
 * @example
 * ```ts
 * createClient({
 *   baseUrl: "https://api.example.com",
 *   plugins: [createTimeoutPlugin({ timeoutMs: 5_000 })],
 * });
 * ```
 */
export function createTimeoutPlugin(options: TimeoutPluginOptions): ApiPlugin {
	return {
		name: "timeout",
		priority: 1,

		beforeRequest(ctx) {
			return { ...ctx, timeoutMs: options.timeoutMs };
		},
	};
}
