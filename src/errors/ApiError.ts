export class ApiError extends Error {
	readonly status: number;
	readonly responseBody: unknown;
	override readonly cause: unknown;

	constructor(
		message: string,
		status: number,
		responseBody?: unknown,
		cause?: unknown,
	) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.responseBody = responseBody;
		this.cause = cause;
	}
}
