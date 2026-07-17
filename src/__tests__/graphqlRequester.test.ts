import { describe, expect, it } from "bun:test";
import type { GraphQLRequestOptions } from "../graphql/types";
import { createGraphQLRequester } from "../graphql/createGraphQLRequester";

const DOCUMENT = "query Media($id: Int) { Media(id: $id) { id } }";

describe("createGraphQLRequester", () => {
	it("maps generated SDK request fields to api-core GraphQL options", async () => {
		let capturedPath: string | undefined;
		let capturedOptions: GraphQLRequestOptions<{ id: number }> | undefined;
		const signal = new AbortController().signal;
		const client = {
			async graphql<TData, TVariables extends object>(
				path: string,
				options: GraphQLRequestOptions<TVariables>,
			): Promise<TData> {
				capturedPath = path;
				capturedOptions = options as GraphQLRequestOptions<{ id: number }>;
				return { Media: { id: 1 } } as TData;
			},
		};
		const requester = createGraphQLRequester(client, {
			path: "/graphql",
			transformDocument: (document) => document.trim(),
		});

		const result = await requester.request<
			{ Media: { id: number } },
			{ id: number }
		>({
			document: ` ${DOCUMENT} `,
			variables: { id: 1 },
			requestHeaders: { "x-client": "generated" },
			signal,
			operationName: "Media",
			timeoutMs: 5_000,
			cacheKey: "media:1",
			tags: ["media"],
		});

		expect(result).toEqual({ Media: { id: 1 } });
		expect(capturedPath).toBe("/graphql");
		expect(capturedOptions).toEqual({
			query: DOCUMENT,
			variables: { id: 1 },
			headers: { "x-client": "generated" },
			signal,
			operationName: "Media",
			timeoutMs: 5_000,
			cacheKey: "media:1",
			tags: ["media"],
		});
	});
});
