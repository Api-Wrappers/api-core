export interface RetryPluginOptions {
	maxAttempts?: number;
	delayMs?: number;
	jitter?: boolean;
	retriableStatusCodes?: number[];
}
