/**
 * Integration and negative-case tests.
 *
 * Each test wires multiple real components together (client + plugins +
 * transport mock) to verify end-to-end behaviour that unit tests cannot
 * cover in isolation.
 */
import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import type { RequestContext } from "../context/RequestContext";
import { ApiError } from "../errors/ApiError";
import { TimeoutError } from "../errors/TimeoutError";
import { createCachePlugin } from "../plugins/cache/cachePlugin";
import { MemoryStore } from "../plugins/cache/memoryStore";
import { createLoggerPlugin } from "../plugins/logger/loggerPlugin";
import { createRetryPlugin } from "../plugins/retry/retryPlugin";
import { createTimeoutPlugin } from "../plugins/timeout/timeoutPlugin";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

// ─── Combined plugin integration ─────────────────────────────────────────────

describe("combined plugins: cache + logger + retry", () => {
	it("serves from cache on second request and does not retry on a cache hit", async () => {
		let transportCalls = 0;
		const store = new MemoryStore();
		const logLines: string[] = [];

		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			retry: { maxAttempts: 3, delayMs: 0, jitter: false },
			plugins: [
				createLoggerPlugin({
					logger: {
						info: (msg) => logLines.push(msg),
						warn: () => {},
						error: () => {},
					},
				}),
				createCachePlugin({ store, ttlMs: 60_000 }),
			],
			transport: {
				execute: async () => {
					transportCalls++;
					return jsonResponse({ value: 42 });
				},
			},
		});

		const first = await client.get<{ value: number }>("/data");
		const second = await client.get<{ value: number }>("/data");

		expect(first.value).toBe(42);
		expect(second.value).toBe(42);
		// Transport called only once despite retry config — cache hit skips it
		expect(transportCalls).toBe(1);
		// Logger ran for both requests (2 beforeRequest lines)
		expect(logLines.filter((l) => l.includes("-->")).length).toBe(2);
	});

	it("retryPlugin overrides maxAttempts per-request on top of cache+logger", async () => {
		let calls = 0;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			retry: { maxAttempts: 1, delayMs: 0, jitter: false }, // default: no retry
			plugins: [
				createLoggerPlugin({
					logger: { info: () => {}, warn: () => {}, error: () => {} },
				}),
				createRetryPlugin({ maxAttempts: 3, delayMs: 0, jitter: false }),
			],
			transport: {
				execute: async () => {
					calls++;
					if (calls < 3) return new Response(null, { status: 503 });
					return jsonResponse({ ok: true });
				},
			},
		});

		const result = await client.get<{ ok: boolean }>("/unstable");
		expect(calls).toBe(3);
		expect(result.ok).toBe(true);
	});
});

// ─── Cache invalidation ───────────────────────────────────────────────────────

describe("cache invalidation", () => {
	it("invalidate(key) removes a specific entry", async () => {
		let calls = 0;
		const store = new MemoryStore();
		const cache = createCachePlugin({ store, ttlMs: 60_000 });
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [cache],
			transport: {
				execute: async () => {
					calls++;
					return jsonResponse({ n: calls });
				},
			},
		});

		await client.get("/item"); // miss → stores
		await client.get("/item"); // hit
		expect(calls).toBe(1);

		await cache.invalidate("GET:https://api.test/item");

		await client.get("/item"); // miss again after invalidation
		expect(calls).toBe(2);
	});

	it("invalidateByTag removes all entries with that tag", async () => {
		let calls = 0;
		const store = new MemoryStore();
		const cache = createCachePlugin({ store, ttlMs: 60_000 });
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [cache],
			transport: {
				execute: async () => {
					calls++;
					return jsonResponse({ n: calls });
				},
			},
		});

		// Cache two separate resources under the same "user" tag
		await client.get("/users/1", { tags: ["user"] });
		await client.get("/users/2", { tags: ["user"] });
		expect(calls).toBe(2);

		// Both are now cached
		await client.get("/users/1", { tags: ["user"] });
		await client.get("/users/2", { tags: ["user"] });
		expect(calls).toBe(2); // still 2

		await cache.invalidateByTag("user");

		// Both must miss now
		await client.get("/users/1", { tags: ["user"] });
		await client.get("/users/2", { tags: ["user"] });
		expect(calls).toBe(4);
	});
});

// ─── Timeout plugin ───────────────────────────────────────────────────────────

describe("createTimeoutPlugin", () => {
	it("stamps timeoutMs on the request context", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createTimeoutPlugin({ timeoutMs: 3_000 })],
			transport: {
				execute: async (ctx) => {
					captured = ctx;
					return jsonResponse({});
				},
			},
		});

		await client.get("/");
		expect(captured?.timeoutMs).toBe(3_000);
	});

	it("overrides ClientConfig.timeoutMs", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			timeoutMs: 10_000,
			plugins: [createTimeoutPlugin({ timeoutMs: 1_000 })],
			transport: {
				execute: async (ctx) => {
					captured = ctx;
					return jsonResponse({});
				},
			},
		});

		await client.get("/");
		expect(captured?.timeoutMs).toBe(1_000);
	});
});

// ─── Custom logger on ClientConfig ───────────────────────────────────────────

describe("ClientConfig.logger", () => {
	it("uses the provided logger for PluginManager onError handler failures", async () => {
		const errorLines: unknown[] = [];
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			logger: {
				info: () => {},
				warn: () => {},
				error: (_msg, data) => errorLines.push(data),
			},
			plugins: [
				{
					name: "bad-error-handler",
					onError() {
						throw new Error("handler explodes");
					},
				},
			],
			transport: {
				execute: async () => {
					throw new Error("network error");
				},
			},
		});

		await expect(client.get("/")).rejects.toThrow("network error");
		// The bad onError handler's own error should have been logged
		expect(errorLines.length).toBe(1);
		expect(errorLines[0]).toBeInstanceOf(Error);
	});
});

// ─── Negative cases ───────────────────────────────────────────────────────────

describe("negative cases", () => {
	it("returns response text when content-type is not JSON", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: {
				execute: async () =>
					new Response("plain text body", {
						status: 200,
						headers: { "content-type": "text/plain" },
					}),
			},
		});

		const result = await client.get<string>("/text");
		expect(result).toBe("plain text body");
	});

	it("throws ApiError carrying the parsed body on a JSON error response", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: {
				execute: async () =>
					jsonResponse({ code: "NOT_FOUND", detail: "resource missing" }, 404),
			},
		});

		let caught: ApiError | undefined;
		try {
			await client.get("/missing");
		} catch (err) {
			if (err instanceof ApiError) caught = err;
		}

		expect(caught?.status).toBe(404);
		expect((caught?.responseBody as Record<string, string>).code).toBe(
			"NOT_FOUND",
		);
	});

	it("plugin throwing in afterResponse propagates and calls onError", async () => {
		let onErrorCalled = false;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				{
					name: "bad-after",
					afterResponse() {
						throw new Error("afterResponse explodes");
					},
					onError() {
						onErrorCalled = true;
					},
				},
			],
			transport: {
				execute: async () => jsonResponse({ ok: true }),
			},
		});

		await expect(client.get("/")).rejects.toThrow("afterResponse explodes");
		expect(onErrorCalled).toBe(true);
	});

	it("exhausts retries and throws the last error", async () => {
		let calls = 0;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			retry: { maxAttempts: 3, delayMs: 0, jitter: false },
			transport: {
				execute: async () => {
					calls++;
					return new Response(null, { status: 503 });
				},
			},
		});

		await expect(client.get("/flaky")).rejects.toBeInstanceOf(ApiError);
		expect(calls).toBe(3);
	});

	it("TimeoutError is thrown when the transport signals abort", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createTimeoutPlugin({ timeoutMs: 1 })],
			transport: {
				// Simulate what fetchTransport does when the AbortController fires
				execute: async () => {
					const err = new Error("The operation was aborted.");
					err.name = "AbortError";
					throw new TimeoutError("Request timed out after 1ms", err);
				},
			},
		});

		await expect(client.get("/slow")).rejects.toBeInstanceOf(TimeoutError);
	});
});
