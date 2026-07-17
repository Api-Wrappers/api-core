import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import { createRetryPlugin } from "../plugins/retry/retryPlugin";

describe("conditional retry policy", () => {
	it("forces tagged unsafe operations to a single attempt", async () => {
		let calls = 0;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			retry: { maxAttempts: 3, delayMs: 0, jitter: false },
			plugins: [
				createRetryPlugin({
					maxAttempts: 1,
					when: (ctx) => ctx.tags?.includes("operation:unsafe") === true,
				}),
			],
			transport: {
				async execute() {
					calls++;
					throw new Error("ambiguous network failure");
				},
			},
		});

		await expect(
			client.post("/mutation", {}, { tags: ["operation:unsafe"] }),
		).rejects.toThrow("ambiguous network failure");
		expect(calls).toBe(1);
	});

	it("leaves the global retry policy unchanged for other requests", async () => {
		let calls = 0;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			retry: { maxAttempts: 3, delayMs: 0, jitter: false },
			plugins: [
				createRetryPlugin({
					maxAttempts: 1,
					when: (ctx) => ctx.tags?.includes("operation:unsafe") === true,
				}),
			],
			transport: {
				async execute() {
					calls++;
					if (calls < 3) return new Response(null, { status: 503 });
					return new Response(JSON.stringify({ ok: true }), {
						headers: { "content-type": "application/json" },
					});
				},
			},
		});

		const result = await client.get<{ ok: boolean }>("/query", {
			tags: ["operation:safe"],
		});

		expect(result.ok).toBe(true);
		expect(calls).toBe(3);
	});
});
