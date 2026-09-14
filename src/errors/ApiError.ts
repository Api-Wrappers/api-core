/** Optional diagnostics attached to {@link ApiError}. */
export interface ApiErrorDetails {
	/** Response headers, when the error came from an HTTP response. */
	headers?: Headers;
	/** Final response URL, when known (empty for synthetic responses). */
	url?: string;
}

export class ApiError extends Error {
	readonly status: number;
	readonly responseBody: unknown;
	override readonly cause: unknown;
	readonly headers?: Headers;
	readonly url?: string;

	constructor(
		message: string,
		status: number,
		responseBody?: unknown,
		cause?: unknown,
		details?: ApiErrorDetails,
	) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.responseBody = responseBody;
		this.cause = cause;
		this.headers = details?.headers;
		this.url = details?.url;
	}
}

/**
 * Extracts {@link ApiErrorDetails} from a `Response`. Useful for custom
 * transports and plugins that construct their own errors.
 */
export function responseErrorDetails(response: Response): ApiErrorDetails {
	return {
		headers: response.headers,
		...(response.url ? { url: response.url } : {}),
	};
}
