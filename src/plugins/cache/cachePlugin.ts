import type { RequestContext } from "../../context/RequestContext";
import { buildUrl } from "../../utils/buildUrl";
import { BUILT_IN_META_KEYS, readCacheHitMeta, readStringMeta } from "../meta";
import { MemoryStore } from "./memoryStore";
import type { CachePlugin, CachePluginOptions } from "./types";

const DEFAULT_CACHEABLE_METHODS = ["GET"] as const;

/**
 * Caches parsed response bodies keyed by method + URL (+ body hash) or an
 * explicit `RequestOptions.cacheKey`.
 *
 * Notes:
 * - Only the parsed body is stored. The synthetic cache-hit response always
 *   reports `status: 200` with `content-type: application/json`, so this
 *   plugin is best suited to JSON APIs. Binary/text payloads round-trip
 *   through `parsedBody`, but `afterResponse` plugins reading the raw
 *   `Response` will see the JSON-serialised form, not the original bytes.
 * - The tag index used by `invalidateByTag` is in-process only. When `store`
 *   is shared across clients/processes (e.g. Redis), prefer explicit
 *   `invalidate(key)` calls — tag invalidation only knows keys stored through
 *   this plugin instance.
 */
export function createCachePlugin(
	options: CachePluginOptions = {},
): CachePlugin {
	const store = options.store ?? new MemoryStore();
	const ttlMs = options.ttlMs;
	const methods: string[] = (
		options.methods ?? [...DEFAULT_CACHEABLE_METHODS]
	).map((method) => method.toUpperCase());
	const generateKey = options.generateKey ?? defaultCacheKey;

	// tag → Set<cacheKey>: populated during afterResponse, used by invalidateByTag.
	const tagIndex = new Map<string, Set<string>>();

	return {
		name: "cache",
		priority: 20,

		async beforeRequest(ctx) {
			if (!methods.includes(ctx.method.toUpperCase())) return ctx;

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
						[BUILT_IN_META_KEYS.cacheHit]: { key, data: cached },
					},
					syntheticResponse,
				};
			}

			return {
				...ctx,
				meta: { ...ctx.meta, [BUILT_IN_META_KEYS.cacheKey]: key },
			};
		},

		async afterResponse(ctx) {
			const hit = readCacheHitMeta(ctx.request.meta);

			if (hit) {
				return {
					...ctx,
					parsedBody: hit.data,
					meta: { ...ctx.meta, [BUILT_IN_META_KEYS.cacheServed]: true },
				};
			}

			const key = readStringMeta(ctx.request.meta, BUILT_IN_META_KEYS.cacheKey);
			if (
				key &&
				methods.includes(ctx.request.method.toUpperCase()) &&
				ctx.response.ok
			) {
				await store.set(key, ctx.parsedBody, ttlMs);

				// Record tag → key associations for invalidateByTag.
				for (const tag of ctx.request.tags ?? []) {
					if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
					tagIndex.get(tag)?.add(key);
				}

				return {
					...ctx,
					meta: { ...ctx.meta, [BUILT_IN_META_KEYS.cacheStored]: true },
				};
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
	const base = `${ctx.method.toUpperCase()}:${buildUrl(ctx.url, ctx.query)}`;
	// POST-style requests opted into caching must vary on the body, otherwise
	// different payloads to the same URL collide on one entry.
	if (ctx.body === undefined) return base;
	return `${base}:body=${hashBody(ctx.body)}`;
}

function hashBody(body: unknown): string {
	if (typeof body === "string") return `s${fnv1a(body)}`;
	try {
		const json = JSON.stringify(body);
		if (json !== undefined) return `j${fnv1a(json)}`;
	} catch {
		// Unserializable body — fall through to the type tag below.
	}
	return `t${typeof body}`;
}

/** FNV-1a 32-bit hash, hex-encoded. Short + deterministic for cache keys. */
function fnv1a(input: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i) ?? 0;
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16);
}

function serializeCachedBody(value: unknown): BodyInit | null {
	try {
		return JSON.stringify(value) ?? null;
	} catch {
		return null;
	}
}
