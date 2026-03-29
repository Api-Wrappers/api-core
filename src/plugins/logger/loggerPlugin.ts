import type { ApiPlugin } from "../../plugin/types";
import type { LoggerPluginOptions } from "./types";

/**
 * Creates a plugin that logs request start, response status, and errors.
 *
 * Log lines are prefixed with `[api-core]` and include the HTTP method, URL,
 * attempt number (on `beforeRequest`), and status code (on `afterResponse`).
 *
 * Priority `10` means it runs _after_ auth or header-mutation plugins
 * (priority < 10) so the logged URL and headers reflect the final request,
 * but _before_ the cache plugin (priority `20`) so cache hits are still
 * visible in the log.
 *
 * @example
 * ```ts
 * createClient({
 *   baseUrl: "https://api.example.com",
 *   plugins: [createLoggerPlugin({ logRequest: true, logResponse: true })],
 * });
 * ```
 */
export function createLoggerPlugin(
	options: LoggerPluginOptions = {},
): ApiPlugin {
	const {
		logRequest = true,
		logResponse = true,
		logError = true,
		logger = console,
	} = options;

	return {
		name: "logger",
		priority: 10,

		beforeRequest(ctx) {
			if (logRequest) {
				logger.info(`[api-core] --> ${ctx.method} ${ctx.url}`, {
					attempt: ctx.attempt,
					body: ctx.body,
				});
			}
			return ctx;
		},

		afterResponse(ctx) {
			if (logResponse) {
				logger.info(
					`[api-core] <-- ${ctx.response.status} ${ctx.request.method} ${ctx.request.url}`,
				);
			}
			return ctx;
		},

		onError(error, ctx) {
			if (logError) {
				logger.error(`[api-core] ERR ${ctx.method} ${ctx.url}`, error);
			}
		},
	};
}
