import type { RequestContext } from "../context/RequestContext";
import type { ResponseContext } from "../context/ResponseContext";
import type { MaybePromise } from "../types/common";

export interface ApiPlugin {
	/** Unique display name for debugging. */
	name: string;
	/** Optional stable identifier, useful if names are duplicated. */
	id?: string;
	/**
	 * Execution order for beforeRequest (ascending) and afterResponse
	 * (descending). Defaults to 100. Plugins with equal priority run
	 * in registration order.
	 */
	priority?: number;
	/** When false the plugin is skipped entirely. Defaults to true. */
	enabled?: boolean;

	/** Called once when the client initializes. */
	setup?(client: unknown): MaybePromise<void>;

	/**
	 * Called before the transport executes. Return a mutated context
	 * or void to keep the existing one.
	 */
	beforeRequest?(ctx: RequestContext): MaybePromise<RequestContext | void>;

	/**
	 * Called after a successful transport response. Return a mutated
	 * context or void to keep the existing one.
	 */
	afterResponse?(ctx: ResponseContext): MaybePromise<ResponseContext | void>;

	/** Called when the request pipeline throws. */
	onError?(error: unknown, ctx: RequestContext): MaybePromise<void>;

	/** Called when the client is disposed. */
	dispose?(): MaybePromise<void>;
}
