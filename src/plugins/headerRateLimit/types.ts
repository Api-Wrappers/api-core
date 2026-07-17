import type { ApiPlugin } from "../../plugin/types";

export type RateLimitResetFormat =
	| "unix-seconds"
	| "unix-milliseconds"
	| "delay-seconds";

export interface HeaderRateLimitState {
	limit?: number;
	remaining?: number;
	resetAt?: number;
	blockedUntil?: number;
}

export interface HeaderRateLimitPluginOptions {
	limitHeader?: string;
	remainingHeader?: string;
	resetHeader?: string;
	retryAfterHeader?: string;
	resetFormat?: RateLimitResetFormat;
	bufferMs?: number;
	now?: () => number;
	wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface HeaderRateLimitPlugin extends ApiPlugin {
	getState(): Readonly<HeaderRateLimitState>;
}
