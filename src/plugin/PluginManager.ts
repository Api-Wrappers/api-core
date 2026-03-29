import type { LoggerInterface } from "../client/types";
import type { RequestContext } from "../context/RequestContext";
import type { ResponseContext } from "../context/ResponseContext";
import type { ApiPlugin } from "./types";

export class PluginManager {
	private readonly plugins: ApiPlugin[] = [];
	private readonly logger: LoggerInterface;

	/**
	 * @param logger - Logger used when an `onError` handler itself throws.
	 *   Defaults to `console`. Pass a no-op object to silence all output.
	 */
	constructor(logger: LoggerInterface = console) {
		this.logger = logger;
	}

	register(plugin: ApiPlugin): void {
		if (plugin.enabled === false) return;
		this.plugins.push(plugin);
		// Sort ascending so lower priority numbers run first in beforeRequest.
		this.plugins.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
	}

	getAll(): readonly ApiPlugin[] {
		return this.plugins;
	}

	async setup(client: unknown): Promise<void> {
		for (const plugin of this.plugins) {
			await plugin.setup?.(client);
		}
	}

	/**
	 * Runs `beforeRequest` in ascending priority order (lowest first).
	 * Each plugin may return a mutated context.
	 */
	async beforeRequest(ctx: RequestContext): Promise<RequestContext> {
		let current = ctx;
		for (const plugin of this.plugins) {
			try {
				const result = await plugin.beforeRequest?.(current);
				if (result != null) current = result;
			} catch (err) {
				throw wrapPluginError(plugin.name, "beforeRequest", err);
			}
		}
		return current;
	}

	/**
	 * Runs `afterResponse` in descending priority order (highest first).
	 * Each plugin may return a mutated context.
	 */
	async afterResponse(ctx: ResponseContext): Promise<ResponseContext> {
		let current = ctx;
		for (const plugin of [...this.plugins].reverse()) {
			try {
				const result = await plugin.afterResponse?.(current);
				if (result != null) current = result;
			} catch (err) {
				throw wrapPluginError(plugin.name, "afterResponse", err);
			}
		}
		return current;
	}

	/**
	 * Runs `onError` on all plugins in registration order. A plugin throwing
	 * here is caught and logged via the configured logger but does not
	 * interrupt other `onError` handlers.
	 */
	async onError(error: unknown, ctx: RequestContext): Promise<void> {
		for (const plugin of this.plugins) {
			try {
				await plugin.onError?.(error, ctx);
			} catch (inner) {
				this.logger.error(
					`[PluginManager] Plugin "${plugin.name}" threw inside onError:`,
					inner,
				);
			}
		}
	}

	async dispose(): Promise<void> {
		for (const plugin of [...this.plugins].reverse()) {
			await plugin.dispose?.();
		}
	}
}

function wrapPluginError(name: string, hook: string, cause: unknown): Error {
	const message = `Plugin "${name}" threw during "${hook}"`;
	const err = new Error(message, { cause });
	err.name = "PluginError";
	return err;
}
