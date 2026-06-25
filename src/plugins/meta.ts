export const BUILT_IN_META_KEYS = {
	cacheHit: "cache.hit",
	cacheKey: "cache.key",
	cacheServed: "cache.served",
	cacheStored: "cache.stored",
	rateLimitRelease: "rateLimit.release",
	retryDelayMs: "retry.delayMs",
	retryJitter: "retry.jitter",
	retryMaxAttempts: "retry.maxAttempts",
	retryRetriableStatusCodes: "retry.retriableStatusCodes",
} as const;

export interface CacheHitMeta {
	key: string;
	data: unknown;
}

export interface RetryMeta {
	delayMs?: number;
	jitter?: boolean;
	maxAttempts?: number;
	retriableStatusCodes?: number[];
}

export function readCacheHitMeta(
	meta: Record<string, unknown>,
): CacheHitMeta | undefined {
	const value = meta[BUILT_IN_META_KEYS.cacheHit];
	if (!isRecord(value) || typeof value.key !== "string" || !("data" in value)) {
		return undefined;
	}
	return { key: value.key, data: value.data };
}

export function readRateLimitRelease(
	meta: Record<string, unknown>,
): (() => void) | undefined {
	const release = meta[BUILT_IN_META_KEYS.rateLimitRelease];
	return typeof release === "function" ? (release as () => void) : undefined;
}

export function readRetryMeta(meta: Record<string, unknown>): RetryMeta {
	const maxAttempts = readNumber(meta, BUILT_IN_META_KEYS.retryMaxAttempts);
	const delayMs = readNumber(meta, BUILT_IN_META_KEYS.retryDelayMs);
	const jitter = readBoolean(meta, BUILT_IN_META_KEYS.retryJitter);
	const retriableStatusCodes = readNumberArray(
		meta,
		BUILT_IN_META_KEYS.retryRetriableStatusCodes,
	);

	return {
		...(maxAttempts !== undefined && { maxAttempts }),
		...(delayMs !== undefined && { delayMs }),
		...(jitter !== undefined && { jitter }),
		...(retriableStatusCodes !== undefined && { retriableStatusCodes }),
	};
}

export function readStringMeta(
	meta: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = meta[key];
	return typeof value === "string" ? value : undefined;
}

function readNumber(
	meta: Record<string, unknown>,
	key: string,
): number | undefined {
	const value = meta[key];
	return typeof value === "number" ? value : undefined;
}

function readBoolean(
	meta: Record<string, unknown>,
	key: string,
): boolean | undefined {
	const value = meta[key];
	return typeof value === "boolean" ? value : undefined;
}

function readNumberArray(
	meta: Record<string, unknown>,
	key: string,
): number[] | undefined {
	const value = meta[key];
	return Array.isArray(value) && value.every((item) => typeof item === "number")
		? value
		: undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
