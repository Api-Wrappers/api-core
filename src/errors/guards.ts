import { GraphQLRequestError } from "../graphql/GraphQLRequestError";
import { ApiError } from "./ApiError";
import { RateLimitError } from "./RateLimitError";
import { TimeoutError } from "./TimeoutError";

export type ApiCoreError =
	| ApiError
	| RateLimitError
	| TimeoutError
	| GraphQLRequestError;

export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
	return error instanceof RateLimitError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
	return error instanceof TimeoutError;
}

export function isGraphQLRequestError(
	error: unknown,
): error is GraphQLRequestError {
	return error instanceof GraphQLRequestError;
}

export function isApiCoreError(error: unknown): error is ApiCoreError {
	return isApiError(error) || isTimeoutError(error);
}
