import type { HeaderInput } from "../types/common";

/**
 * The shape of a single error object inside a GraphQL `errors` array,
 * as specified by the GraphQL over HTTP specification.
 */
export interface GraphQLErrorDetail {
	/** Human-readable error message. */
	message: string;
	/**
	 * Path into the response `data` tree where the error occurred.
	 * Each element is a field name (string) or list index (number).
	 */
	path?: (string | number)[];
	/** Source locations in the document that triggered the error. */
	locations?: { line: number; column: number }[];
	/** Arbitrary extension data attached by the server. */
	extensions?: Record<string, unknown>;
}

/**
 * Raw response envelope returned by any spec-compliant GraphQL server.
 * `data` is absent on a request-level failure; `errors` is absent on
 * a fully successful response.
 */
export interface GraphQLResponse<TData = unknown> {
	data?: TData;
	errors?: GraphQLErrorDetail[];
	extensions?: Record<string, unknown>;
}

/**
 * Options for {@link BaseHttpClient.graphql}.
 *
 * @typeParam TVariables - Shape of the variables object. Defaults to
 *   `Record<string, unknown>`. Provide a specific type for compile-time
 *   variable checking.
 */
export interface GraphQLRequestOptions<
	TVariables extends object = Record<string, unknown>,
> {
	/**
	 * The GraphQL query or mutation document string.
	 * @example `query GetUser($id: ID!) { user(id: $id) { name } }`
	 */
	query: string;
	/** Variables to substitute into the document. */
	variables?: TVariables;
	/**
	 * Name of the operation to execute when the document contains multiple
	 * named operations.
	 */
	operationName?: string;
	/**
	 * Additional headers merged on top of `ClientConfig.defaultHeaders` for
	 * this request only. `content-type: application/json` is always set.
	 */
	headers?: HeaderInput;
	/**
	 * Optional caller-provided abort signal. Composes with `timeoutMs`.
	 */
	signal?: AbortSignal;
	/**
	 * Per-request timeout override in milliseconds. Throws
	 * {@link TimeoutError} when exceeded.
	 */
	timeoutMs?: number;
	/**
	 * Explicit cache key for {@link createCachePlugin}. The cache plugin
	 * skips POST requests by default — provide this to opt a specific
	 * operation into caching.
	 * @example `"gql:GetUser:${userId}"`
	 */
	cacheKey?: string;
	/**
	 * Arbitrary string tags passed through to the `RequestContext`. Useful
	 * for metrics grouping or cache invalidation in custom plugins.
	 */
	tags?: string[];
}
