import type { ApiPlugin } from "../../plugin/types";
import type { RetryPluginOptions } from "./types";

/**
 * Writes retry configuration into request context meta so the
 * BaseHttpClient retry loop can read it. Use this when you need
 * per-request retry overrides rather than global ClientConfig.retry.
 */
export function createRetryPlugin(options: RetryPluginOptions = {}): ApiPlugin {
	return {
		name: "retry",
		priority: 5,

		beforeRequest(ctx) {
			// Only write keys for values the caller explicitly provided.
			// Unset options fall through to ClientConfig.retry defaults inside
			// BaseHttpClient, so the plugin does not need to supply fallbacks.
			if (options.maxAttempts !== undefined)
				ctx.meta["retry.maxAttempts"] = options.maxAttempts;
			if (options.delayMs !== undefined)
				ctx.meta["retry.delayMs"] = options.delayMs;
			if (options.jitter !== undefined)
				ctx.meta["retry.jitter"] = options.jitter;
			if (options.retriableStatusCodes !== undefined)
				ctx.meta["retry.retriableStatusCodes"] = options.retriableStatusCodes;
			return ctx;
		},
	};
}
