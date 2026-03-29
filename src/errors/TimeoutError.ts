export class TimeoutError extends Error {
	override readonly cause: unknown;

	constructor(message = "Request timed out", cause?: unknown) {
		super(message);
		this.name = "TimeoutError";
		this.cause = cause;
	}
}
