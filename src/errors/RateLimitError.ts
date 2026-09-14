import { ApiError, type ApiErrorDetails } from "./ApiError";

export class RateLimitError extends ApiError {
	readonly retryAfterMs: number | undefined;

	constructor(
		retryAfterMs?: number,
		responseBody?: unknown,
		cause?: unknown,
		details?: ApiErrorDetails,
	) {
		super("Rate limit exceeded", 429, responseBody, cause, details);
		this.name = "RateLimitError";
		this.retryAfterMs = retryAfterMs;
	}
}
