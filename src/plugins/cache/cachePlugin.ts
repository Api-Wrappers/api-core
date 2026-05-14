import type { RequestContext } from "../../context/RequestContext";
import { buildUrl } from "../../utils/buildUrl";
import { MemoryStore } from "./memoryStore";
import type { CachePlugin, CachePluginOptions } from "./types";

const DEFAULT_CACHEABLE_METHODS = ["GET"] as const;
const CACHE_HIT_META_KEY = "cache.hit";

export function createCachePlugin(
	options: CachePluginOptions = {},
): CachePlugin {
	const store = options.store ?? new MemoryStore();
	const ttlMs = options.ttlMs;
	const methods: string[] = options.methods ?? [...DEFAULT_CACHEABLE_METHODS];
	const generateKey = options.generateKey ?? defaultCacheKey;

	// tag → Set<cacheKey>: populated during afterResponse, used by invalidateByTag.
	const tagIndex = new Map<string, Set<string>>();

	return {
		name: "cache",
		priority: 20,

		async beforeRequest(ctx) {
			if (!methods.includes(ctx.method)) return ctx;

			const key = ctx.cacheKey ?? generateKey(ctx);
			const cached = await store.get(key);

			if (cached !== undefined) {
				// Build a synthetic Response so the rest of the pipeline
				// (afterResponse, status checks) sees a uniform shape.
				const syntheticResponse = new Response(serializeCachedBody(cached), {
					status: 200,
					headers: { "content-type": "application/json" },
				});

				// Setting syntheticResponse tells BaseHttpClient to skip the
				// transport entirely and use this response directly.
				return {
					...ctx,
					meta: {
						...ctx.meta,
						[CACHE_HIT_META_KEY]: { key, data: cached },
					},
					syntheticResponse,
				};
			}

			return {
				...ctx,
				meta: { ...ctx.meta, "cache.key": key },
			};
		},

		async afterResponse(ctx) {
			const hit = ctx.request.meta[CACHE_HIT_META_KEY] as
				| { key: string; data: unknown }
				| undefined;

			if (hit) {
				return {
					...ctx,
					parsedBody: hit.data,
					meta: { ...ctx.meta, "cache.served": true },
				};
			}

			const key = ctx.request.meta["cache.key"] as string | undefined;
			if (key && methods.includes(ctx.request.method) && ctx.response.ok) {
				await store.set(key, ctx.parsedBody, ttlMs);
				ctx.meta["cache.stored"] = true;

				// Record tag → key associations for invalidateByTag.
				for (const tag of ctx.request.tags ?? []) {
					if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
					tagIndex.get(tag)?.add(key);
				}
			}

			return ctx;
		},

		async invalidate(key: string): Promise<void> {
			await store.delete(key);
			// Clean up any tag index entries pointing to this key.
			for (const keys of tagIndex.values()) {
				keys.delete(key);
			}
		},

		async invalidateByTag(tag: string): Promise<void> {
			const keys = tagIndex.get(tag);
			if (!keys || keys.size === 0) return;
			for (const key of keys) {
				await store.delete(key);
				// Remove this key from all other tag index entries too.
				for (const otherKeys of tagIndex.values()) {
					otherKeys.delete(key);
				}
			}
			tagIndex.delete(tag);
		},
	};
}

function defaultCacheKey(ctx: RequestContext): string {
	return `${ctx.method}:${buildUrl(ctx.url, ctx.query)}`;
}

function serializeCachedBody(value: unknown): BodyInit | null {
	try {
		return JSON.stringify(value) ?? null;
	} catch {
		return null;
	}
}
