import type { RequestContext } from "../../context/RequestContext";
import { createPassThroughError } from "../../plugin/passThroughError";
import type { ApiPlugin } from "../../plugin/types";
import { BUILT_IN_META_KEYS, readRateLimitRelease } from "../meta";
import type { RateLimitPluginOptions } from "./types";

interface QueueItem {
	resolve: (release: () => void) => void;
	reject: (reason: unknown) => void;
	signal?: AbortSignal;
	onAbort?: () => void;
}

/**
 * Throttles request starts before they reach the transport. Supports
 * concurrency, minimum spacing, and fixed-window request budgets.
 */
export function createRateLimitPlugin(
	options: RateLimitPluginOptions = {},
): ApiPlugin {
	const maxConcurrent = options.maxConcurrent ?? Number.POSITIVE_INFINITY;
	const minTimeMs = options.minTimeMs ?? 0;
	const maxRequestsPerInterval = options.maxRequestsPerInterval;
	const intervalMs = options.intervalMs;

	if (maxConcurrent <= 0) {
		throw new Error("maxConcurrent must be greater than 0");
	}
	if (minTimeMs < 0) {
		throw new Error("minTimeMs must be greater than or equal to 0");
	}
	if (
		(maxRequestsPerInterval !== undefined || intervalMs !== undefined) &&
		(!maxRequestsPerInterval ||
			maxRequestsPerInterval <= 0 ||
			!intervalMs ||
			intervalMs <= 0)
	) {
		throw new Error(
			"maxRequestsPerInterval and intervalMs must both be greater than 0",
		);
	}

	const queue: QueueItem[] = [];
	const starts: number[] = [];
	let active = 0;
	let lastStartAt = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const processQueue = () => {
		if (timer) {
			clearTimeout(timer);
			timer = undefined;
		}

		while (queue.length > 0) {
			const now = Date.now();
			pruneStarts(now);

			if (active >= maxConcurrent) return;

			const waitMs = getWaitMs(now);
			if (waitMs > 0) {
				timer = setTimeout(processQueue, waitMs);
				return;
			}

			const item = queue.shift();
			if (!item) return;
			cleanupQueueItem(item);

			if (item.signal?.aborted) {
				item.reject(getAbortReason(item.signal));
				continue;
			}

			active++;
			lastStartAt = now;
			starts.push(now);

			let released = false;
			item.resolve(() => {
				if (released) return;
				released = true;
				active--;
				processQueue();
			});
		}
	};

	const acquire = (signal?: AbortSignal) =>
		new Promise<() => void>((resolve, reject) => {
			if (signal?.aborted) {
				reject(createPassThroughError(getAbortReason(signal)));
				return;
			}

			const item: QueueItem = { resolve, reject, signal };
			item.onAbort = () => {
				const index = queue.indexOf(item);
				if (index !== -1) {
					queue.splice(index, 1);
				}
				cleanupQueueItem(item);
				if (queue.length === 0 && timer) {
					clearTimeout(timer);
					timer = undefined;
				}
				reject(
					createPassThroughError(
						item.signal
							? getAbortReason(item.signal)
							: new Error("The operation was aborted."),
					),
				);
			};

			signal?.addEventListener("abort", item.onAbort, { once: true });
			queue.push(item);
			processQueue();
		});

	const release = (ctx: RequestContext) => {
		const releaseFn = readRateLimitRelease(ctx.meta);
		if (!releaseFn) return;
		delete ctx.meta[BUILT_IN_META_KEYS.rateLimitRelease];
		releaseFn();
	};

	const cleanupQueueItem = (item: QueueItem) => {
		if (item.signal && item.onAbort) {
			item.signal.removeEventListener("abort", item.onAbort);
			item.onAbort = undefined;
		}
	};

	const pruneStarts = (now: number) => {
		if (!intervalMs) return;
		while (starts.length > 0 && now - (starts[0] ?? 0) >= intervalMs) {
			starts.shift();
		}
	};

	const getWaitMs = (now: number): number => {
		const spacingWait = Math.max(0, lastStartAt + minTimeMs - now);
		if (!maxRequestsPerInterval || !intervalMs) return spacingWait;

		if (starts.length < maxRequestsPerInterval) return spacingWait;

		const oldest = starts[0] ?? now;
		const intervalWait = Math.max(0, oldest + intervalMs - now);
		return Math.max(spacingWait, intervalWait);
	};

	return {
		name: "rate-limit",
		priority: 1,

		async beforeRequest(ctx) {
			const releaseFn = await acquire(ctx.signal);
			return {
				...ctx,
				meta: { ...ctx.meta, [BUILT_IN_META_KEYS.rateLimitRelease]: releaseFn },
			};
		},

		afterResponse(ctx) {
			release(ctx.request);
			return ctx;
		},

		onError(_error, ctx) {
			release(ctx);
		},
	};
}

function getAbortReason(signal: AbortSignal): unknown {
	if (signal.reason !== undefined) return signal.reason;
	if (typeof DOMException !== "undefined") {
		return new DOMException("The operation was aborted.", "AbortError");
	}
	return new Error("The operation was aborted.");
}
