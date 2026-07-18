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
 */
export class GraphQLRequestError<
	TError extends GraphQLErrorDetail = GraphQLErrorDetail,
> extends ApiError {
	/** The errors array from the GraphQL response envelope. */
	readonly graphqlErrors: readonly TError[];
	/**
	 * Partial `data` returned alongside `errors`, if any. `undefined` when
	 * the server returned no `data` field.
	 */
	readonly partialData: unknown;

	constructor(errors: TError[], partialData?: unknown, cause?: unknown) {
		const message = errors.map((error) => error.message).join("; ");
		super(`GraphQL errors: ${message}`, 200, { errors }, cause);
		this.name = "GraphQLRequestError";
		this.graphqlErrors = errors;
		this.partialData = partialData;
	}
}
