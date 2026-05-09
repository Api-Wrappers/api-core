import { ApiError } from "./ApiError";

export class RateLimitError extends ApiError {
	readonly retryAfterMs: number | undefined;

	constructor(retryAfterMs?: number, responseBody?: unknown, cause?: unknown) {
		super("Rate limit exceeded", 429, responseBody, cause);
		this.name = "RateLimitError";
		this.retryAfterMs = retryAfterMs;
	}
}
