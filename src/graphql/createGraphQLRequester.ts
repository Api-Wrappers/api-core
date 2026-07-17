import type { BaseHttpClient } from "../client/BaseHttpClient";
import type { HeaderInput } from "../types/common";

/** Request shape used by generated GraphQL SDKs that accept a custom requester. */
export interface GraphQLRequesterOptions<
	TVariables extends object = Record<string, never>,
> {
	document: string;
	variables?: TVariables;
	requestHeaders?: HeaderInput;
	signal?: AbortSignal;
	operationName?: string;
	timeoutMs?: number;
	cacheKey?: string;
	tags?: string[];
}

/** Minimal requester contract compatible with generated GraphQL SDK clients. */
export interface GraphQLRequester {
	request<
		TData = unknown,
		TVariables extends object = Record<string, never>,
	>(options: GraphQLRequesterOptions<TVariables>): Promise<TData>;
}

export interface CreateGraphQLRequesterOptions {
	/** GraphQL endpoint path appended to the client's base URL. Defaults to an empty path. */
	path?: string;
	/** Optional document transform applied immediately before each request. */
	transformDocument?: (document: string) => string;
}

/**
 * Adapts a {@link BaseHttpClient} into the requester shape commonly expected by
 * generated GraphQL SDKs while preserving the api-core request pipeline.
 */
export function createGraphQLRequester(
	client: Pick<BaseHttpClient, "graphql">,
	options: CreateGraphQLRequesterOptions = {},
): GraphQLRequester {
	const path = options.path ?? "";

	return {
		request<
			TData = unknown,
			TVariables extends object = Record<string, never>,
		>({
			document,
			variables,
			requestHeaders,
			signal,
			operationName,
			timeoutMs,
			cacheKey,
			tags,
		}: GraphQLRequesterOptions<TVariables>): Promise<TData> {
			return client.graphql<TData, TVariables>(path, {
				query: options.transformDocument?.(document) ?? document,
				variables,
				headers: requestHeaders,
				signal,
				operationName,
				timeoutMs,
				cacheKey,
				tags,
			});
		},
	};
}
