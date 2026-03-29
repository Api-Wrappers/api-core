import { ApiError } from "../errors/ApiError";
import type { GraphQLErrorDetail } from "./types";

/**
 * Thrown when a GraphQL server returns a well-formed HTTP 200 response that
 * contains a non-empty `errors` array.
 *
 * Extends {@link ApiError} so that code catching `ApiError` also catches
 * GraphQL-level failures. Callers that need to inspect the individual error
 * objects can narrow with `instanceof GraphQLRequestError` and read
 * `graphqlErrors`.
 *
 * When the server returns both `data` and `errors` (partial result), the
 * partial data is available on `partialData` but the error is still thrown —
 * callers must explicitly opt in to consuming partial results.
 *
 * @example
 * ```ts
 * import { GraphQLRequestError } from "@tdanks2000/api-core";
 *
 * try {
 *   const data = await client.graphql<MyQuery>("/graphql", { query: QUERY });
 * } catch (err) {
 *   if (err instanceof GraphQLRequestError) {
 *     for (const e of err.graphqlErrors) {
 *       console.error(e.message, e.path);
 *     }
 *   }
 * }
 * ```
 */
export class GraphQLRequestError extends ApiError {
	/** The errors array from the GraphQL response envelope. */
	readonly graphqlErrors: readonly GraphQLErrorDetail[];
	/**
	 * Partial `data` returned alongside `errors`, if any. `undefined` when
	 * the server returned no `data` field.
	 */
	readonly partialData: unknown;

	constructor(
		errors: GraphQLErrorDetail[],
		partialData?: unknown,
		cause?: unknown,
	) {
		const message = errors.map((e) => e.message).join("; ");
		// Status 200: the HTTP request succeeded; the failure is at the
		// GraphQL application layer, not the transport layer.
		super(`GraphQL errors: ${message}`, 200, { errors }, cause);
		this.name = "GraphQLRequestError";
		this.graphqlErrors = errors;
		this.partialData = partialData;
	}
}
