import type { ApiPlugin } from "../plugin/types";
import type { Transport } from "../transport/types";

/**
 * Minimal logger interface accepted by {@link ClientConfig.logger} and
 * {@link PluginManager}. Compatible with `console` out of the box.
 */
export interface LoggerInterface {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

/**
 * Retry behaviour applied to every request made by this client.
 * Per-request overrides are possible via {@link createRetryPlugin}.
 */
export interface RetryConfig {
	/**
	 * Maximum total attempts, including the first. A value of `1` means no
	 * retries (the default when `retry` is omitted from {@link ClientConfig}).
	 */
	maxAttempts: number;
	/** Base delay in ms between attempts before exponential backoff. Defaults to `500`. */
	delayMs?: number;
	/**
	 * When `true`, a random multiplier in `[0.5, 1)` is applied on top of
	 * exponential backoff so parallel clients don't all retry simultaneously.
	 * Defaults to `true`.
	 */
	jitter?: boolean;
	/**
	 * HTTP status codes that trigger a retry. `429` also reads the
	 * `retry-after` header. Defaults to `[429, 500, 502, 503, 504]`.
	 */
	retriableStatusCodes?: number[];
}

/** Configuration passed to {@link BaseHttpClient} or {@link createClient}. */
export interface ClientConfig {
	/**
	 * Base URL prepended to every `path` argument. No trailing slash;
	 * paths should start with `/`.
	 * @example "https://api.example.com/v1"
	 */
	baseUrl: string;
	/**
	 * Headers merged into every request. Per-request `headers` take
	 * precedence. `content-type: application/json` is always present as the
	 * lowest-priority default.
	 */
	defaultHeaders?: Record<string, string>;
	/** Plugins registered for the lifetime of this client. */
	plugins?: ApiPlugin[];
	/**
	 * Transport implementation for executing requests. Defaults to
	 * {@link fetchTransport}. Swap in tests to avoid real network calls.
	 * When both `transport` and `fetch` are provided, `transport` wins.
	 */
	transport?: Transport;
	/**
	 * Custom `fetch` implementation used by the default {@link fetchTransport}.
	 * Useful for polyfills or interceptors (e.g. `node-fetch`, `undici`).
	 * Ignored when a custom `transport` is provided.
	 * @example `import fetch from "node-fetch"; createClient({ fetch })`
	 */
	fetch?: typeof globalThis.fetch;
	/**
	 * Default request timeout in ms. Overridable per-request via
	 * `RequestOptions.timeoutMs`. Throws {@link TimeoutError} when exceeded.
	 */
	timeoutMs?: number;
	/**
	 * Global retry policy. Omitting means no retries (`maxAttempts: 1`).
	 * Per-request overrides via {@link createRetryPlugin}.
	 */
	retry?: RetryConfig;
	/**
	 * Logger used for internal diagnostics (e.g. plugin `onError` handler
	 * failures). Defaults to `console`. Pass a no-op logger to silence all
	 * internal output; pass a structured logger for production observability.
	 * @example `{ info: () => {}, warn: () => {}, error: () => {} }`
	 */
	logger?: LoggerInterface;
}
