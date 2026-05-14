import { describe, expect, it } from "bun:test";
import { ApiError } from "../errors/ApiError";
import {
	isApiCoreError,
	isApiError,
	isGraphQLRequestError,
	isRateLimitError,
	isTimeoutError,
} from "../errors/guards";
import { RateLimitError } from "../errors/RateLimitError";
import { TimeoutError } from "../errors/TimeoutError";
import { GraphQLRequestError } from "../graphql/GraphQLRequestError";

describe("error guards", () => {
	it("narrows api-core error classes", () => {
		const apiError = new ApiError("bad request", 400);
		const rateLimitError = new RateLimitError(1_000);
		const timeoutError = new TimeoutError();
		const graphqlError = new GraphQLRequestError([{ message: "bad query" }]);

		expect(isApiError(apiError)).toBe(true);
		expect(isRateLimitError(rateLimitError)).toBe(true);
		expect(isTimeoutError(timeoutError)).toBe(true);
		expect(isGraphQLRequestError(graphqlError)).toBe(true);

		expect(isApiCoreError(apiError)).toBe(true);
		expect(isApiCoreError(rateLimitError)).toBe(true);
		expect(isApiCoreError(timeoutError)).toBe(true);
		expect(isApiCoreError(graphqlError)).toBe(true);
		expect(isApiCoreError(new Error("other"))).toBe(false);
		expect(isApiCoreError("nope")).toBe(false);
	});
});
