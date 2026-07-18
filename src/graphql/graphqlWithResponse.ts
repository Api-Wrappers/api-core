import type { ApiResponse, BaseHttpClient } from "../client/BaseHttpClient";
import { mergeHeaders } from "../utils/mergeHeaders";
import { GraphQLRequestError } from "./GraphQLRequestError";
import type { GraphQLRequestOptions, GraphQLResponse } from "./types";

export interface GraphQLApiResponse<TData> extends ApiResponse<TData> {
	/** Optional GraphQL response extensions returned by the server. */
	extensions?: Record<string, unknown>;
}

/**
 * Executes a GraphQL operation while retaining the raw response, request
 * context, plugin metadata, and GraphQL extensions.
 */
export async function graphqlWithResponse<
	TData = unknown,
	TVariables extends object = Record<string, unknown>,
>(
	client: Pick<BaseHttpClient, "requestWithResponse">,
	path: string,
	options: GraphQLRequestOptions<TVariables>,
): Promise<GraphQLApiResponse<TData>> {
	const {
		query,
		variables,
		operationName,
		headers,
		signal,
		timeoutMs,
		cacheKey,
		tags,
	} = options;
	const result = await client.requestWithResponse<GraphQLResponse<TData>>(
		path,
		{
			method: "POST",
			body: {
				query,
				...(variables !== undefined && { variables }),
				...(operationName !== undefined && { operationName }),
			},
			headers: mergeHeaders(headers, { "content-type": "application/json" }),
			signal,
			timeoutMs,
			cacheKey,
			tags,
		},
	);
	const envelope = result.data;

	if (envelope.errors && envelope.errors.length > 0) {
		throw new GraphQLRequestError(envelope.errors, envelope.data);
	}

	return {
		...result,
		data: envelope.data as TData,
		extensions: envelope.extensions,
	};
}
