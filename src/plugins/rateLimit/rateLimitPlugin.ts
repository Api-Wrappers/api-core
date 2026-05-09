import type { RequestContext } from "../../context/RequestContext";
import type { ApiPlugin } from "../../plugin/types";
import type { RateLimitPluginOptions } from "./types";

const RELEASE_META_KEY = "rateLimit.release";

interface QueueItem {
	resolve: (release: () => void) => void;
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

	const acquire = () =>
		new Promise<() => void>((resolve) => {
			queue.push({ resolve });
			processQueue();
		});

	const release = (ctx: RequestContext) => {
		const releaseFn = ctx.meta[RELEASE_META_KEY] as (() => void) | undefined;
		if (!releaseFn) return;
		delete ctx.meta[RELEASE_META_KEY];
		releaseFn();
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
			const releaseFn = await acquire();
			return {
				...ctx,
				meta: { ...ctx.meta, [RELEASE_META_KEY]: releaseFn },
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
