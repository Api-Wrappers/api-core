/**
 * @module @api-wrappers/api-core
 *
 * Shared HTTP client runtime for the `api-wrappers` organisation.
 *
 * ## Quick start
 * ```ts
 * import { createClient, createLoggerPlugin, createCachePlugin } from "@api-wrappers/api-core";
 *
 * const client = createClient({
 *   baseUrl: "https://api.example.com/v1",
 *   plugins: [createLoggerPlugin(), createCachePlugin({ ttlMs: 60_000 })],
 *   retry: { maxAttempts: 3, delayMs: 300 },
 * });
 *
 * const data = await client.get<MyType>("/endpoint");
 * ```
 *
 * ## GraphQL
 * ```ts
 * const data = await client.graphql<MyQuery, MyQueryVariables>("/graphql", {
 *   query: MY_QUERY,
 *   variables: { id: "123" },
 * });
 * ```
 *
 * ## Plugin execution order
 * - `beforeRequest` runs in **ascending** priority order (lower number first).
 * - `afterResponse` runs in **descending** priority order (higher number first).
 * - `onError` runs all plugins regardless of priority; individual handler
 *   failures are caught and logged without interrupting others.
 */

// ─── Client ───────────────────────────────────────────────────────────────────

export type {
	ApiResponse,
	RequestOptions,
	ResponseType,
} from "./client/BaseHttpClient";
export { BaseHttpClient } from "./client/BaseHttpClient";
export { createClient } from "./client/createClient";
export type {
	ClientConfig,
	LoggerInterface,
	RetryConfig,
} from "./client/types";

// ─── Context ──────────────────────────────────────────────────────────────────

export type { RequestContext } from "./context/RequestContext";
export type { ResponseContext } from "./context/ResponseContext";

// ─── Errors ───────────────────────────────────────────────────────────────────

export { ApiError } from "./errors/ApiError";
export { RateLimitError } from "./errors/RateLimitError";
export { TimeoutError } from "./errors/TimeoutError";

// ─── Plugin system ────────────────────────────────────────────────────────────

export { PluginManager } from "./plugin/PluginManager";
export type { ApiPlugin } from "./plugin/types";

// ─── Built-in plugins ─────────────────────────────────────────────────────────

export { createAuthPlugin } from "./plugins/auth/authPlugin";
export type { AuthPluginOptions } from "./plugins/auth/types";
export { createCachePlugin } from "./plugins/cache/cachePlugin";
export { MemoryStore } from "./plugins/cache/memoryStore";
export type {
	CachePlugin,
	CachePluginOptions,
	CacheStore,
} from "./plugins/cache/types";

export { createLoggerPlugin } from "./plugins/logger/loggerPlugin";
export type { LoggerPluginOptions } from "./plugins/logger/types";
export { createRateLimitPlugin } from "./plugins/rateLimit/rateLimitPlugin";
export type { RateLimitPluginOptions } from "./plugins/rateLimit/types";
export { createRetryPlugin } from "./plugins/retry/retryPlugin";
export type { RetryPluginOptions } from "./plugins/retry/types";
export { createTimeoutPlugin } from "./plugins/timeout/timeoutPlugin";
export type { TimeoutPluginOptions } from "./plugins/timeout/types";

// ─── GraphQL ─────────────────────────────────────────────────────────────────
// client.graphql() lives on BaseHttpClient — re-exported above via BaseHttpClient.
// These exports cover the standalone types and error class.

export { GraphQLRequestError } from "./graphql/GraphQLRequestError";
export { gql } from "./graphql/gql";
export type {
	GraphQLErrorDetail,
	GraphQLRequestOptions,
	GraphQLResponse,
} from "./graphql/types";

// ─── Transport ────────────────────────────────────────────────────────────────

export {
	createFetchTransport,
	fetchTransport,
} from "./transport/fetchTransport";
export type { Transport } from "./transport/types";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type {
	HttpMethod,
	MaybePromise,
	QueryParams,
	QueryPrimitive,
	QueryValue,
} from "./types/common";

// ─── Utilities ────────────────────────────────────────────────────────────────

export { buildUrl } from "./utils/buildUrl";
export { isPlainObject } from "./utils/isPlainObject";
export { mergeHeaders } from "./utils/mergeHeaders";
export { resolveUrl } from "./utils/resolveUrl";
export { sleep } from "./utils/sleep";
