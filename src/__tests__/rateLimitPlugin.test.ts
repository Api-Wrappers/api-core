import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import { createRateLimitPlugin } from "../plugins/rateLimit/rateLimitPlugin";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("createRateLimitPlugin", () => {
	it("limits concurrent transport calls", async () => {
		let active = 0;
		let maxActive = 0;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createRateLimitPlugin({ maxConcurrent: 1 })],
			transport: {
				execute: async () => {
					active++;
					maxActive = Math.max(maxActive, active);
					await new Promise((resolve) => setTimeout(resolve, 5));
					active--;
					return jsonResponse({});
				},
			},
		});

		await Promise.all([client.get("/a"), client.get("/b"), client.get("/c")]);

		expect(maxActive).toBe(1);
	});

	it("spaces request starts when minTimeMs is set", async () => {
		const starts: number[] = [];
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createRateLimitPlugin({ minTimeMs: 10 })],
			transport: {
				execute: async () => {
					starts.push(Date.now());
					return jsonResponse({});
				},
			},
		});

		await Promise.all([client.get("/a"), client.get("/b")]);

		expect((starts[1] ?? 0) - (starts[0] ?? 0)).toBeGreaterThanOrEqual(8);
	});

	it("releases queued requests after transport errors", async () => {
		let calls = 0;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createRateLimitPlugin({ maxConcurrent: 1 })],
			transport: {
				execute: async () => {
					calls++;
					if (calls === 1) throw new Error("boom");
					return jsonResponse({ ok: true });
				},
			},
		});

		const [first, second] = await Promise.allSettled([
			client.get("/a"),
			client.get<{ ok: boolean }>("/b"),
		]);

		expect(first.status).toBe("rejected");
		expect(second.status).toBe("fulfilled");
		if (second.status === "fulfilled") {
			expect(second.value.ok).toBe(true);
		}
	});

	it("rejects queued requests promptly when their signal aborts", async () => {
		let transportCalls = 0;
		let releaseFirst: (() => void) | undefined;
		let markFirstStarted: (() => void) | undefined;
		const firstStarted = new Promise<void>((resolve) => {
			markFirstStarted = resolve;
		});
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createRateLimitPlugin({ maxConcurrent: 1 })],
			transport: {
				execute: async () => {
					transportCalls++;
					markFirstStarted?.();
					await new Promise<void>((release) => {
						releaseFirst = release;
					});
					return jsonResponse({ ok: true });
				},
			},
		});

		const first = client.get("/a");
		await firstStarted;

		const controller = new AbortController();
		const second = client.get("/b", { signal: controller.signal });

		controller.abort(new Error("cancelled"));

		await expect(second).rejects.toThrow("cancelled");
		expect(transportCalls).toBe(1);
		releaseFirst?.();
		await expect(first).resolves.toEqual({ ok: true });
	});

	it("rejects already-aborted signals before acquiring a slot", async () => {
		let transportCalls = 0;
		const controller = new AbortController();
		controller.abort(new Error("already done"));

		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createRateLimitPlugin({ maxConcurrent: 1 })],
			transport: {
				execute: async () => {
					transportCalls++;
					return jsonResponse({});
				},
			},
		});

		await expect(
			client.get("/a", { signal: controller.signal }),
		).rejects.toThrow("already done");
		expect(transportCalls).toBe(0);
	});

	it("releases queued requests after a later beforeRequest plugin throws", async () => {
		let shouldThrow = true;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				createRateLimitPlugin({ maxConcurrent: 1 }),
				{
					name: "sometimes-bad",
					priority: 10,
					beforeRequest(ctx) {
						if (!shouldThrow) return ctx;
						shouldThrow = false;
						throw new Error("before boom");
					},
				},
			],
			transport: {
				execute: async () => jsonResponse({ ok: true }),
			},
		});

		const [first, second] = await Promise.allSettled([
			client.get("/a"),
			client.get<{ ok: boolean }>("/b"),
		]);

		expect(first.status).toBe("rejected");
		expect(second.status).toBe("fulfilled");
		if (second.status === "fulfilled") {
			expect(second.value.ok).toBe(true);
		}
	});

	it("releases queued requests after a later afterResponse plugin throws", async () => {
		let shouldThrow = true;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				createRateLimitPlugin({ maxConcurrent: 1 }),
				{
					name: "bad-after",
					priority: 10,
					afterResponse(ctx) {
						if (!shouldThrow) return ctx;
						shouldThrow = false;
						throw new Error("after boom");
					},
				},
			],
			transport: {
				execute: async () => jsonResponse({ ok: true }),
			},
		});

		const [first, second] = await Promise.allSettled([
			client.get("/a"),
			client.get<{ ok: boolean }>("/b"),
		]);

		expect(first.status).toBe("rejected");
		expect(second.status).toBe("fulfilled");
		if (second.status === "fulfilled") {
			expect(second.value.ok).toBe(true);
		}
	});
});
