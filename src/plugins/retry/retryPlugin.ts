import type { ApiPlugin } from "../../plugin/types";
import { normalizeRetryMaxAttempts } from "../../utils/normalizeRetryMaxAttempts";
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
			const meta = { ...ctx.meta };
			let retryCount = ctx.retryCount;

			// Only write keys for values the caller explicitly provided.
			// Unset options fall through to ClientConfig.retry defaults inside
			// BaseHttpClient, so the plugin does not need to supply fallbacks.
			if (options.maxAttempts !== undefined) {
				meta["retry.maxAttempts"] = options.maxAttempts;
				retryCount =
					normalizeRetryMaxAttempts(options.maxAttempts) - 1 - ctx.attempt;
			}
			if (options.delayMs !== undefined)
				meta["retry.delayMs"] = options.delayMs;
			if (options.jitter !== undefined) meta["retry.jitter"] = options.jitter;
			if (options.retriableStatusCodes !== undefined)
				meta["retry.retriableStatusCodes"] = options.retriableStatusCodes;
			return { ...ctx, meta, retryCount };
		},
	};
}
