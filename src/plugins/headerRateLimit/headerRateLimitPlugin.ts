import type { ResponseContext } from "../../context/ResponseContext";
import { createPassThroughError } from "../../plugin/passThroughError";
import type {
	HeaderRateLimitPlugin,
	HeaderRateLimitPluginOptions,
	HeaderRateLimitState,
	RateLimitResetFormat,
} from "./types";

/**
 * Adapts client-side request timing to rate-limit headers returned by an API.
 * The plugin only pauses requests after the server reports an exhausted budget
 * or supplies `Retry-After`; it does not assume a provider-specific limit.
 */
export function createHeaderRateLimitPlugin(
	options: HeaderRateLimitPluginOptions = {},
): HeaderRateLimitPlugin {
	const limitHeader = normalizeHeader(
		options.limitHeader ?? "x-ratelimit-limit",
	);
	const remainingHeader = normalizeHeader(
		options.remainingHeader ?? "x-ratelimit-remaining",
	);
	const resetHeader = normalizeHeader(
		options.resetHeader ?? "x-ratelimit-reset",
	);
	const retryAfterHeader = normalizeHeader(
		options.retryAfterHeader ?? "retry-after",
	);
	const resetFormat = options.resetFormat ?? "unix-seconds";
	const bufferMs = options.bufferMs ?? 0;
	const now = options.now ?? Date.now;
	const wait = options.wait ?? waitWithSignal;
	const state: HeaderRateLimitState = {};

	if (bufferMs < 0) {
		throw new Error("bufferMs must be greater than or equal to 0");
	}

	return {
		name: "header-rate-limit",
		priority: 0,

		async beforeRequest(ctx) {
			const blockedUntil = state.blockedUntil ?? 0;
			const waitMs = Math.max(0, blockedUntil - now());
			if (waitMs > 0) await wait(waitMs, ctx.signal);
			return ctx;
		},

		afterResponse(ctx) {
			updateState(ctx, {
				limitHeader,
				remainingHeader,
				resetHeader,
				retryAfterHeader,
				resetFormat,
				bufferMs,
				now,
				state,
			});
			return ctx;
		},

		getState() {
			return { ...state };
		},
	};
}

interface StateUpdateOptions {
	limitHeader: string;
	remainingHeader: string;
	resetHeader: string;
	retryAfterHeader: string;
	resetFormat: RateLimitResetFormat;
	bufferMs: number;
	now: () => number;
	state: HeaderRateLimitState;
}

function updateState(ctx: ResponseContext, options: StateUpdateOptions): void {
	const currentTime = options.now();
	const headers = ctx.response.headers;
	const limit = parseFiniteNumber(headers.get(options.limitHeader));
	const remaining = parseFiniteNumber(headers.get(options.remainingHeader));
	const resetAt = parseResetAt(
		headers.get(options.resetHeader),
		options.resetFormat,
		currentTime,
	);
	const retryAt = parseRetryAfter(
		headers.get(options.retryAfterHeader),
		currentTime,
	);

	if (limit !== undefined) options.state.limit = limit;
	if (remaining !== undefined) options.state.remaining = remaining;
	if (resetAt !== undefined) options.state.resetAt = resetAt;

	let blockedUntil = options.state.blockedUntil ?? 0;
	if (remaining !== undefined && remaining <= 0 && resetAt !== undefined) {
		blockedUntil = Math.max(blockedUntil, resetAt + options.bufferMs);
	}
	if (retryAt !== undefined) {
		blockedUntil = Math.max(blockedUntil, retryAt + options.bufferMs);
	}

	if (blockedUntil > currentTime) {
		options.state.blockedUntil = blockedUntil;
	} else {
		delete options.state.blockedUntil;
	}
}

function parseResetAt(
	value: string | null,
	format: RateLimitResetFormat,
	now: number,
): number | undefined {
	const parsed = parseFiniteNumber(value);
	if (parsed === undefined) return undefined;
	if (format === "unix-milliseconds") return Math.max(0, parsed);
	if (format === "delay-seconds") return now + Math.max(0, parsed * 1_000);
	return Math.max(0, parsed * 1_000);
}

function parseRetryAfter(
	value: string | null,
	now: number,
): number | undefined {
	if (!value) return undefined;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return now + Math.max(0, seconds * 1_000);
	const date = Date.parse(value);
	return Number.isNaN(date) ? undefined : Math.max(now, date);
}

function parseFiniteNumber(value: string | null): number | undefined {
	if (value === null || value.trim() === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeHeader(value: string): string {
	return value.toLowerCase();
}

function waitWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(createPassThroughError(getAbortReason(signal)));
			return;
		}

		let onAbort: (() => void) | undefined;
		const cleanup = () => {
			if (onAbort) signal?.removeEventListener("abort", onAbort);
		};
		const timer = setTimeout(() => {
			cleanup();
			resolve();
		}, ms);
		onAbort = () => {
			clearTimeout(timer);
			cleanup();
			reject(createPassThroughError(getAbortReason(signal)));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

function getAbortReason(signal?: AbortSignal): unknown {
	if (signal?.reason !== undefined) return signal.reason;
	if (typeof DOMException !== "undefined") {
		return new DOMException("The operation was aborted.", "AbortError");
	}
	return new Error("The operation was aborted.");
}
