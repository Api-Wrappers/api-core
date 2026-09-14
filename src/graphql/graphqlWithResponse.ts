import {
	executeGraphQL,
	type GraphQLApiResponse,
	type GraphQLClientLike,
} from "./executeGraphQL";
import type { GraphQLRequestOptions } from "./types";

export type { GraphQLApiResponse, GraphQLClientLike } from "./executeGraphQL";

/**
 * Executes a GraphQL operation while retaining the raw response, request
 * context, plugin metadata, and GraphQL extensions.
 *
 * GraphQL application errors and malformed envelopes are reported to the
 * client's plugins through `onError` before being thrown, matching
 * {@link BaseHttpClient.graphql}.
 */
export async function graphqlWithResponse<
	TData = unknown,
	TVariables extends object = Record<string, unknown>,
>(
	client: GraphQLClientLike,
	path: string,
	options: GraphQLRequestOptions<TVariables>,
): Promise<GraphQLApiResponse<TData>> {
	return executeGraphQL<TData, TVariables>(client, path, options);
}
