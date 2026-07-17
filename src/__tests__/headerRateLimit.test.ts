import { describe, expect, it } from "bun:test";
import type { RequestContext } from "../context/RequestContext";
import type { ResponseContext } from "../context/ResponseContext";
import { createHeaderRateLimitPlugin } from "../plugins/headerRateLimit/headerRateLimitPlugin";

const request: RequestContext = {
	url: "https://api.test/graphql",
	method: "POST",
	headers: {},
	meta: {},
	retryCount: 0,
	attempt: 0,
};

function response(headers: HeadersInit): ResponseContext {
	return {
		request,
		response: new Response(null, { status: 200, headers }),
		meta: {},
	};
}

describe("createHeaderRateLimitPlugin", () => {
	it("waits until a server-reported reset after the budget is exhausted", async () => {
		let currentTime = 1_000;
		const waits: number[] = [];
		const plugin = createHeaderRateLimitPlugin({
			now: () => currentTime,
			wait: async (ms) => {
				waits.push(ms);
				currentTime += ms;
			},
		});

		await plugin.afterResponse?.(
			response({
				"x-ratelimit-limit": "90",
				"x-ratelimit-remaining": "0",
				"x-ratelimit-reset": "3",
			}),
		);
		await plugin.beforeRequest?.(request);

		expect(waits).toEqual([2_000]);
		expect(plugin.getState()).toEqual({
			limit: 90,
			remaining: 0,
			resetAt: 3_000,
			blockedUntil: 3_000,
		});
	});

	it("honours Retry-After independently of remaining headers", async () => {
		const waits: number[] = [];
		const plugin = createHeaderRateLimitPlugin({
			now: () => 10_000,
			wait: async (ms) => waits.push(ms),
		});

		await plugin.afterResponse?.(response({ "retry-after": "5" }));
		await plugin.beforeRequest?.(request);

		expect(waits).toEqual([5_000]);
		expect(plugin.getState().blockedUntil).toBe(15_000);
	});
});
