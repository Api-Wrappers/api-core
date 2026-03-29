import type { HttpMethod } from "../types/common";

export interface RequestContext {
	url: string;
	method: HttpMethod;
	headers: Record<string, string>;
	body?: unknown;
	query?: Record<string, string | number | boolean | undefined>;
	meta: Record<string, unknown>;
	cacheKey?: string;
	tags?: string[];
	/**
	 * Number of retry attempts still available after this one.
	 * Equals `maxAttempts - 1 - attempt`, so it counts down from
	 * `maxAttempts - 1` on the first attempt to `0` on the last.
	 * Read-only from a plugin's perspective; set by BaseHttpClient.
	 */
	retryCount: number;
	/** Zero-based index of the current attempt (0 = first try). */
	attempt: number;
	timeoutMs?: number;
	/**
	 * When set by a plugin during `beforeRequest`, `BaseHttpClient` will use
	 * this response directly and skip calling the transport altogether.
	 * Plugins that short-circuit the network (e.g. cache hits) should populate
	 * this field instead of relying solely on `meta`.
	 */
	syntheticResponse?: Response;
}
