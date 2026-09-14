import type { ApiResponse, BaseHttpClient } from "../client/BaseHttpClient";
import type { RequestContext } from "../context/RequestContext";
import { ApiError, responseErrorDetails } from "../errors/ApiError";
import { isPlainObject } from "../utils/isPlainObject";
import { mergeHeaders } from "../utils/mergeHeaders";
import { GraphQLRequestError } from "./GraphQLRequestError";
import type { GraphQLRequestOptions, GraphQLResponse } from "./types";

export interface GraphQLApiResponse<TData> extends ApiResponse<TData> {
	/** Optional GraphQL response extensions returned by the server. */
	extensions?: Record<string, unknown>;
}

/**
 * Minimal client surface required to execute a GraphQL operation. A real
 * {@link BaseHttpClient} also implements `notifyError`, which surfaces
 * post-pipeline failures (GraphQL application errors and malformed
 * envelopes) to plugins.
 */
export type GraphQLClientLike = Pick<BaseHttpClient, "requestWithResponse"> & {
	notifyError?(error: unknown, ctx: RequestContext): Promise<void>;
};

/**
 * Returns true when a parsed response looks like a GraphQL envelope: a plain
 * object whose `errors` field, when present, is an array (or `null`, which
 * some servers send for a fully successful response).
 */
function isGraphQLResponseEnvelope(value: unknown): value is GraphQLResponse {
	if (!isPlainObject(value)) return false;
	const errors = value.errors;
	return errors === undefined || errors === null || Array.isArray(errors);
}

/**
 * Executes a GraphQL operation through the client request pipeline and
 * unwraps the response envelope, retaining the raw response, request
 * context, plugin metadata, and GraphQL extensions.
 *
 * Shared by {@link BaseHttpClient.graphql} and {@link graphqlWithResponse} so
 * both surfaces validate envelopes and report failures identically.
 */
export async function executeGraphQL<
	TData = unknown,
	TVariables extends object = Record<string, unknown>,
>(
	client: GraphQLClientLike,
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

	if (!isGraphQLResponseEnvelope(envelope)) {
		const err = new ApiError(
			"Invalid GraphQL response envelope",
			result.response.status,
			envelope,
			undefined,
			responseErrorDetails(result.response),
		);
		await client.notifyError?.(err, result.request);
		throw err;
	}

	// Surface GraphQL application-layer errors as a typed exception.
	// We throw even when partial data is present — callers who need
	// partial results can catch GraphQLRequestError and read .partialData.
	if (envelope.errors && envelope.errors.length > 0) {
		const err = new GraphQLRequestError(
			envelope.errors,
			envelope.data,
			undefined,
			responseErrorDetails(result.response),
		);
		await client.notifyError?.(err, result.request);
		throw err;
	}

	return {
		...result,
		data: envelope.data as TData,
		extensions: envelope.extensions,
	};
}
