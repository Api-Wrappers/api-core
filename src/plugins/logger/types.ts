export interface LoggerInterface {
	info(message: string, data?: unknown): void;
	warn?(message: string, data?: unknown): void;
	error(message: string, data?: unknown): void;
}

export interface LoggerPluginOptions {
	logRequest?: boolean;
	logResponse?: boolean;
	logError?: boolean;
	logger?: LoggerInterface;
}
