export interface RateLimitPluginOptions {
	/**
	 * Maximum number of requests allowed to run at the same time.
	 * Defaults to `Infinity`.
	 */
	maxConcurrent?: number;
	/**
	 * Minimum delay between request starts. Defaults to `0`.
	 */
	minTimeMs?: number;
	/**
	 * Maximum number of request starts allowed during `intervalMs`.
	 * Both fields must be provided to enable windowed limiting.
	 */
	maxRequestsPerInterval?: number;
	intervalMs?: number;
}
