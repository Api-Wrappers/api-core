import type { RequestContext } from "../../context/RequestContext";

export interface RetryPluginOptions {
	maxAttempts?: number;
	delayMs?: number;
	jitter?: boolean;
	retriableStatusCodes?: number[];
	/**
	 * Applies this retry override only when the predicate returns true.
	 * Useful for classifying safe reads and unsafe mutations through request
	 * tags without changing the client's global retry policy.
	 */
	when?: (ctx: RequestContext) => boolean;
}
