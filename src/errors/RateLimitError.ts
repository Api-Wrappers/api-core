import { ApiError } from "./ApiError";

export class RateLimitError extends ApiError {
	readonly retryAfterMs: number | undefined;

	constructor(retryAfterMs?: number, cause?: unknown) {
		super("Rate limit exceeded", 429, undefined, cause);
		this.name = "RateLimitError";
		this.retryAfterMs = retryAfterMs;
	}
}
