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
			transport: makeTransport(async () => new Response(null, { status: 429 })),
		});

		await expect(client.get("/limited")).rejects.toBeInstanceOf(RateLimitError);
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
});
