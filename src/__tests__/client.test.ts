import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import type { RequestContext } from "../context/RequestContext";
import { ApiError } from "../errors/ApiError";
import { RateLimitError } from "../errors/RateLimitError";
import type { Transport } from "../transport/types";

function makeTransport(
	handler: (ctx: RequestContext) => Promise<Response>,
): Transport {
	return { execute: handler };
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("BaseHttpClient", () => {
	it("makes a GET request and returns parsed JSON", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: makeTransport(async () => jsonResponse({ ok: true })),
		});

		const result = await client.get<{ ok: boolean }>("/health");
		expect(result.ok).toBe(true);
	});

	it("attaches default headers to every request", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			defaultHeaders: { "x-api-key": "secret" },
			transport: makeTransport(async (ctx) => {
				captured = ctx;
				return jsonResponse({});
			}),
		});

		await client.get("/");
		expect(captured?.headers["x-api-key"]).toBe("secret");
	});

	it("passes query params through to transport", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: makeTransport(async (ctx) => {
				captured = ctx;
				return jsonResponse({});
			}),
		});

		await client.get("/search", { query: { q: "test", page: 2 } });
		expect(captured?.query).toEqual({ q: "test", page: 2 });
	});

	it("joins baseUrl and path consistently", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test/v1/",
			transport: makeTransport(async (ctx) => {
				captured = ctx;
				return jsonResponse({});
			}),
		});

		await client.get("/health");
		expect(captured?.url).toBe("https://api.test/v1/health");
	});

	it("returns parsed body plus response details with requestWithResponse", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				{
					name: "meta",
					afterResponse(ctx) {
						return { ...ctx, meta: { ...ctx.meta, source: "test" } };
					},
				},
			],
			transport: makeTransport(async () => jsonResponse({ ok: true })),
		});

		const result = await client.requestWithResponse<{ ok: boolean }>("/health");

		expect(result.data.ok).toBe(true);
		expect(result.response.status).toBe(200);
		expect(result.request.url).toBe("https://api.test/health");
		expect(result.meta.source).toBe("test");
	});

	it("returns binary bodies when responseType is arrayBuffer", async () => {
		const bytes = new Uint8Array([8, 1, 18, 4]);
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: makeTransport(
				async () =>
					new Response(bytes, {
						headers: { "content-type": "application/octet-stream" },
					}),
			),
		});

		const result = await client.post<ArrayBuffer>("/games.pb", "fields id;", {
			headers: { accept: "application/octet-stream" },
			responseType: "arrayBuffer",
		});

		expect([...new Uint8Array(result)]).toEqual([...bytes]);
	});

	it("keeps non-ok response parsing automatic for binary requests", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: makeTransport(
				async () =>
					new Response(JSON.stringify({ message: "bad token" }), {
						status: 401,
						headers: { "content-type": "application/json" },
					}),
			),
		});

		try {
			await client.post<ArrayBuffer>("/games.pb", "fields id;", {
				responseType: "arrayBuffer",
			});
			throw new Error("Expected request to fail");
		} catch (err) {
			expect(err).toBeInstanceOf(ApiError);
			expect((err as ApiError).responseBody).toEqual({ message: "bad token" });
		}
	});

	it("throws ApiError on non-ok response", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: makeTransport(async () =>
				jsonResponse({ message: "not found" }, 404),
			),
		});

		await expect(client.get("/missing")).rejects.toBeInstanceOf(ApiError);
	});

	it("throws RateLimitError on 429", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: makeTransport(
				async () =>
					new Response(JSON.stringify({ error: "slow down" }), {
						status: 429,
						headers: {
							"content-type": "application/json",
							"retry-after": "2",
						},
					}),
			),
		});

		let caught: RateLimitError | undefined;
		try {
			await client.get("/limited");
		} catch (err) {
			if (err instanceof RateLimitError) caught = err;
		}

		expect(caught).toBeInstanceOf(RateLimitError);
		expect(caught?.retryAfterMs).toBe(2_000);
		expect(caught?.responseBody).toEqual({ error: "slow down" });
	});

	it("runs beforeRequest plugin", async () => {
		let mutated = false;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				{
					name: "tagger",
					beforeRequest(ctx) {
						mutated = true;
						return { ...ctx, tags: ["test"] };
					},
				},
			],
			transport: makeTransport(async () => jsonResponse({})),
		});

		await client.get("/");
		expect(mutated).toBe(true);
	});

	it("runs afterResponse plugin", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				{
					name: "transformer",
					afterResponse(ctx) {
						return { ...ctx, parsedBody: { transformed: true } };
					},
				},
			],
			transport: makeTransport(async () => jsonResponse({ original: true })),
		});

		const result = await client.get<{ transformed: boolean }>("/");
		expect(result.transformed).toBe(true);
	});

	it("retries on retriable status codes", async () => {
		let calls = 0;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			retry: { maxAttempts: 3, delayMs: 0, jitter: false },
			transport: makeTransport(async () => {
				calls++;
				if (calls < 3) return new Response(null, { status: 503 });
				return jsonResponse({ ok: true });
			}),
		});

		const result = await client.get<{ ok: boolean }>("/");
		expect(calls).toBe(3);
		expect(result.ok).toBe(true);
	});

	it("calls onError plugin when transport throws", async () => {
		let errorCaught: unknown;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				{
					name: "error-handler",
					onError(err) {
						errorCaught = err;
					},
				},
			],
			transport: makeTransport(async () => {
				throw new Error("network down");
			}),
		});

		await expect(client.get("/")).rejects.toThrow("network down");
		expect(errorCaught).toBeDefined();
	});

	it("works with no plugins at all", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: makeTransport(async () => jsonResponse({ bare: true })),
		});

		const result = await client.get<{ bare: boolean }>("/");
		expect(result.bare).toBe(true);
	});

	it("returns undefined for empty successful responses", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: makeTransport(async () => new Response(null, { status: 204 })),
		});

		const result = await client.delete("/resource");
		expect(result).toBeUndefined();
	});
});
