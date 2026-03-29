import { describe, expect, it, mock } from "bun:test";
import type { RequestContext } from "../context/RequestContext";
import type { ResponseContext } from "../context/ResponseContext";
import { PluginManager } from "../plugin/PluginManager";
import type { ApiPlugin } from "../plugin/types";

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
	return {
		url: "https://api.test/v1",
		method: "GET",
		headers: {},
		meta: {},
		retryCount: 0,
		attempt: 0,
		...overrides,
	};
}

function makeResCtx(ctx: RequestContext): ResponseContext {
	return {
		request: ctx,
		response: new Response("{}"),
		parsedBody: {},
		meta: {},
	};
}

describe("PluginManager", () => {
	it("skips plugins with enabled=false", async () => {
		const spy = mock(() => {});
		const pm = new PluginManager();
		pm.register({
			name: "disabled",
			enabled: false,
			beforeRequest: spy as unknown as ApiPlugin["beforeRequest"],
		});
		const ctx = makeCtx();
		await pm.beforeRequest(ctx);
		expect(spy).not.toHaveBeenCalled();
	});

	it("runs beforeRequest in ascending priority order", async () => {
		const order: string[] = [];
		const pm = new PluginManager();
		pm.register({
			name: "b",
			priority: 200,
			beforeRequest(ctx) {
				order.push("b");
				return ctx;
			},
		});
		pm.register({
			name: "a",
			priority: 10,
			beforeRequest(ctx) {
				order.push("a");
				return ctx;
			},
		});
		await pm.beforeRequest(makeCtx());
		expect(order).toEqual(["a", "b"]);
	});

	it("runs afterResponse in descending priority order", async () => {
		const order: string[] = [];
		const pm = new PluginManager();
		pm.register({
			name: "a",
			priority: 10,
			afterResponse(ctx) {
				order.push("a");
				return ctx;
			},
		});
		pm.register({
			name: "b",
			priority: 200,
			afterResponse(ctx) {
				order.push("b");
				return ctx;
			},
		});
		const ctx = makeCtx();
		await pm.afterResponse(makeResCtx(ctx));
		expect(order).toEqual(["b", "a"]);
	});

	it("propagates mutated context between plugins", async () => {
		const pm = new PluginManager();
		pm.register({
			name: "tagger",
			priority: 1,
			beforeRequest(ctx) {
				return { ...ctx, meta: { ...ctx.meta, tagged: true } };
			},
		});
		pm.register({
			name: "checker",
			priority: 2,
			beforeRequest(ctx) {
				expect(ctx.meta.tagged).toBe(true);
				return ctx;
			},
		});
		await pm.beforeRequest(makeCtx());
	});

	it("wraps plugin errors with plugin name", async () => {
		const pm = new PluginManager();
		pm.register({
			name: "boom",
			beforeRequest() {
				throw new Error("original");
			},
		});
		await expect(pm.beforeRequest(makeCtx())).rejects.toMatchObject({
			name: "PluginError",
			message: expect.stringContaining("boom"),
		});
	});

	it("does not rethrow errors from onError handlers", async () => {
		const pm = new PluginManager();
		pm.register({
			name: "bad-error-handler",
			onError() {
				throw new Error("handler itself explodes");
			},
		});
		// Should not throw
		await pm.onError(new Error("original"), makeCtx());
	});

	it("calls dispose in reverse priority order", async () => {
		const order: string[] = [];
		const pm = new PluginManager();
		pm.register({
			name: "a",
			priority: 10,
			dispose() {
				order.push("a");
			},
		});
		pm.register({
			name: "b",
			priority: 200,
			dispose() {
				order.push("b");
			},
		});
		await pm.dispose();
		expect(order).toEqual(["b", "a"]);
	});
});
