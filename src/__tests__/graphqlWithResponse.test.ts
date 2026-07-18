import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import type { RequestContext } from "../context/RequestContext";
import { GraphQLRequestError } from "../graphql/GraphQLRequestError";
import { graphqlWithResponse } from "../graphql/graphqlWithResponse";

const QUERY = "query Viewer { Viewer { id } }";

describe("graphqlWithResponse", () => {
	it("returns data with the raw response and GraphQL extensions", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: {
				async execute(ctx) {
					captured = ctx;
					return new Response(
						JSON.stringify({
							data: { Viewer: { id: 1 } },
							extensions: { traceId: "trace-1" },
						}),
						{
							headers: {
								"content-type": "application/json",
								"x-ratelimit-remaining": "89",
							},
						},
					);
				},
			},
		});

		const result = await graphqlWithResponse<{
			Viewer: { id: number };
		}>(client, "/graphql", {
			query: QUERY,
			tags: ["viewer"],
		});
		expect(captured).toBeDefined();
		const request = captured as RequestContext;

		expect(result.data.Viewer.id).toBe(1);
		expect(result.extensions).toEqual({ traceId: "trace-1" });
		expect(result.response.headers.get("x-ratelimit-remaining")).toBe("89");
		expect(result.request).toBe(request);
		expect(result.request.tags).toEqual(["viewer"]);
	});

	it("throws GraphQLRequestError for application errors", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: {
				async execute() {
					return new Response(
						JSON.stringify({ errors: [{ message: "Denied" }] }),
						{ headers: { "content-type": "application/json" } },
					);
				},
			},
		});

		await expect(
			graphqlWithResponse(client, "/graphql", { query: QUERY }),
		).rejects.toBeInstanceOf(GraphQLRequestError);
	});
});
