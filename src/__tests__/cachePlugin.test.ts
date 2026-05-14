import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import { createCachePlugin } from "../plugins/cache/cachePlugin";
import { MemoryStore } from "../plugins/cache/memoryStore";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("cachePlugin", () => {
	it("stores and serves cached responses", async () => {
		let transportCalls = 0;
		const store = new MemoryStore();
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createCachePlugin({ store, ttlMs: 60_000 })],
			transport: {
				execute: async () => {
					transportCalls++;
					return jsonResponse({ data: "fresh" });
				},
			},
		});

		await client.get("/data");
		const second = await client.get<{ data: string }>("/data");

		expect(second.data).toBe("fresh");
		// Second call should come from cache, transport called only once
		expect(transportCalls).toBe(1);
	});

	it("marks response meta when serving a cache hit", async () => {
		const servedFlags: unknown[] = [];
		const store = new MemoryStore();
		const cache = createCachePlugin({ store, ttlMs: 60_000 });
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				{
					name: "observer",
					priority: 10,
					afterResponse(ctx) {
						servedFlags.push(ctx.meta["cache.served"]);
						return ctx;
					},
				},
				cache,
			],
			transport: {
				execute: async () => jsonResponse({ data: "fresh" }),
			},
		});

		await client.get("/data");
		await client.get("/data");

		expect(servedFlags).toEqual([undefined, true]);
	});

	it("does not cache non-GET requests", async () => {
		let calls = 0;
		const store = new MemoryStore();
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createCachePlugin({ store })],
			transport: {
				execute: async () => {
					calls++;
					return jsonResponse({});
				},
			},
		});

		await client.post("/data", { x: 1 });
		await client.post("/data", { x: 1 });

		expect(calls).toBe(2);
	});

	it("uses transport-equivalent query serialization for default keys", async () => {
		let calls = 0;
		const store = new MemoryStore();
		const cache = createCachePlugin({ store });
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [cache],
			transport: {
				execute: async () => {
					calls++;
					return jsonResponse({ calls });
				},
			},
		});

		await client.get("/search", {
			query: { genre: [1, 2], ignored: null },
		});
		const second = await client.get<{ calls: number }>("/search", {
			query: { genre: [1, 2] },
		});

		expect(second.calls).toBe(1);
		expect(calls).toBe(1);

		await cache.invalidate("GET:https://api.test/search?genre=1&genre=2");
		await client.get("/search", { query: { genre: [1, 2] } });
		expect(calls).toBe(2);
	});

	it("serves cached values that cannot be JSON stringified", async () => {
		let calls = 0;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				{
					name: "bigint-transform",
					priority: 30,
					afterResponse(ctx) {
						return { ...ctx, parsedBody: 1n };
					},
				},
				createCachePlugin(),
			],
			transport: {
				execute: async () => {
					calls++;
					return jsonResponse({ value: calls });
				},
			},
		});

		await client.get("/data");
		const second = await client.get<bigint>("/data");

		expect(second).toBe(1n);
		expect(calls).toBe(1);
	});
});

describe("MemoryStore", () => {
	it("returns undefined for missing keys", () => {
		const store = new MemoryStore();
		expect(store.get("missing")).toBeUndefined();
	});

	it("expires entries after ttlMs", async () => {
		const store = new MemoryStore();
		store.set("key", "value", 10);
		await new Promise((r) => setTimeout(r, 20));
		expect(store.get("key")).toBeUndefined();
	});

	it("clears all entries", () => {
		const store = new MemoryStore();
		store.set("a", 1);
		store.set("b", 2);
		store.clear();
		expect(store.get("a")).toBeUndefined();
		expect(store.get("b")).toBeUndefined();
	});
});
