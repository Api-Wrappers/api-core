import { describe, expect, it } from "bun:test";
import { GraphQLRequestError } from "../graphql/GraphQLRequestError";
import type { GraphQLErrorDetail, GraphQLResponse } from "../graphql/types";

type AniListError = GraphQLErrorDetail<
	{ status: number },
	{ code?: string; retryAfter?: number }
>;

describe("GraphQL vendor error typing", () => {
	it("preserves provider-specific top-level and extension fields", () => {
		const response: GraphQLResponse<unknown, AniListError> = {
			errors: [
				{
					message: "Too many requests",
					status: 429,
					extensions: { code: "RATE_LIMITED", retryAfter: 60 },
				},
			],
		};
		const error = new GraphQLRequestError(response.errors ?? []);

		expect(error.graphqlErrors[0]?.status).toBe(429);
		expect(error.graphqlErrors[0]?.extensions?.code).toBe("RATE_LIMITED");
		expect(error.graphqlErrors[0]?.extensions?.retryAfter).toBe(60);
	});
});
