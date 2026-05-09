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
});
