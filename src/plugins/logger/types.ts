export interface LoggerInterface {
	info(message: string, data?: unknown): void;
	warn?(message: string, data?: unknown): void;
	error(message: string, data?: unknown): void;
}

export interface LoggerPluginOptions {
	logRequest?: boolean;
	logResponse?: boolean;
	logError?: boolean;
	/**
	 * Include `ctx.body` in request logs. Defaults to `false` so sensitive
	 * payloads are not emitted unless a caller opts in.
	 */
	logBody?: boolean;
	/**
	 * Optional hook for redacting or shaping the request body when `logBody` is
	 * enabled. Return value is passed to `logger.info`.
	 */
	redactBody?: (body: unknown) => unknown;
	logger?: LoggerInterface;
}
