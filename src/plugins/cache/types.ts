import type { RequestContext } from "../../context/RequestContext";
import type { ApiPlugin } from "../../plugin/types";
import type { HttpMethod, MaybePromise } from "../../types/common";

export interface CacheStore {
	get(key: string): MaybePromise<unknown | undefined>;
	set(key: string, value: unknown, ttlMs?: number): MaybePromise<void>;
	delete(key: string): MaybePromise<void>;
	clear(): MaybePromise<void>;
}

export interface CachePluginOptions {
	store?: CacheStore;
	ttlMs?: number;
	methods?: HttpMethod[];
	generateKey?: (ctx: RequestContext) => string;
}

/**
 * The object returned by {@link createCachePlugin}. Extends {@link ApiPlugin}
 * with first-class cache invalidation methods.
 */
export interface CachePlugin extends ApiPlugin {
	/**
	 * Removes a single entry from the cache by its exact key.
	 * The key is either the auto-generated `"METHOD:url?query"` string or the
	 * explicit `cacheKey` passed in `RequestOptions`.
	 */
	invalidate(key: string): Promise<void>;
	/**
	 * Removes all cache entries that were stored with the given tag.
	 * Tags are attached to requests via `RequestOptions.tags`. Only entries
	 * cached after this plugin was registered will have tag associations.
	 */
	invalidateByTag(tag: string): Promise<void>;
}
