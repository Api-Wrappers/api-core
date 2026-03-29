import { BaseHttpClient } from "./BaseHttpClient";
import type { ClientConfig } from "./types";

/**
 * Factory function that creates a {@link BaseHttpClient} from the given
 * config. Prefer this over `new BaseHttpClient(config)` in application code
 * so that the concrete class stays an implementation detail.
 *
 * @example
 * ```ts
 * const client = createClient({
 *   baseUrl: "https://api.example.com/v1",
 *   defaultHeaders: { "x-api-key": "secret" },
 *   retry: { maxAttempts: 3, delayMs: 300 },
 *   plugins: [createLoggerPlugin(), createCachePlugin({ ttlMs: 60_000 })],
 * });
 * ```
 */
export function createClient(config: ClientConfig): BaseHttpClient {
	return new BaseHttpClient(config);
}
