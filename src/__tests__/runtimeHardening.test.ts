import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import type { RequestContext } from "../context/RequestContext";
import { ApiError } from "../errors/ApiError";
import { GraphQLRequestError } from "../graphql/GraphQLRequestError";
import { createTimeoutPlugin } from "../plugins/timeout/timeoutPlugin";
import { mergeHeaders } from "../utils/mergeHeaders";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("request cancellation: aborts are not retried", () => {
	it("fails fast when the caller signal is already aborted", async () => {
		let calls = 0;
		const controller = new AbortController();
		controller.abort(new Error("user-cancelled"));

		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			retry: { maxAttempts: 3, delayMs: 1, jitter: false },
			transport: {
				async execute(ctx: RequestContext) {
					calls++;
					throw ctx.signal?.aborted
						? (ctx.signal.reason ?? new Error("aborted"))
						: new Error("boom");
				},
			},
		});

		await expect(
			client.get("/a", { signal: controller.signal }),
		).rejects.toThrow("user-cancelled");
		expect(calls).toBe(1);
	});

	it("aborts the backoff wait instead of retrying", async () => {
		let calls = 0;
		const controller = new AbortController();
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			retry: { maxAttempts: 3, delayMs: 50, jitter: false },
			transport: {
				async execute() {
					calls++;
					return new Response(null, { status: 503 });
				},
			},
		});

		const pending = client.get("/a", { signal: controller.signal });
		setTimeout(() => controller.abort(new Error("cancel-during-backoff")), 10);

		await expect(pending).rejects.toThrow("cancel-during-backoff");
		expect(calls).toBe(1);
	});
});

describe("retry backoff", () => {
	it("waits for the backoff delay before retrying", async () => {
		let calls = 0;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			retry: { maxAttempts: 2, delayMs: 10, jitter: false },
			transport: {
				async execute() {
					calls++;
					if (calls === 1) return new Response(null, { status: 503 });
					return jsonResponse({ ok: true });
				},
			},
		});

		const start = Date.now();
		const result = await client.get<{ ok: boolean }>("/a");

		expect(result.ok).toBe(true);
		expect(calls).toBe(2);
		expect(Date.now() - start).toBeGreaterThanOrEqual(8);
	});
});

describe("timeout precedence", () => {
	it("per-request timeoutMs wins over the timeout plugin", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			timeoutMs: 10_000,
			plugins: [createTimeoutPlugin({ timeoutMs: 1_000 })],
			transport: {
				async execute(ctx: RequestContext) {
					captured = ctx;
					return jsonResponse({ ok: true });
				},
			},
		});

		await client.get("/a", { timeoutMs: 5_000 });
		expect(captured?.timeoutMs).toBe(5_000);
	});

	it("plugin still overrides ClientConfig when no per-request value is given", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			timeoutMs: 10_000,
			plugins: [createTimeoutPlugin({ timeoutMs: 1_000 })],
			transport: {
				async execute(ctx: RequestContext) {
					captured = ctx;
					return jsonResponse({ ok: true });
				},
			},
		});

		await client.get("/a");
		expect(captured?.timeoutMs).toBe(1_000);
	});

	it("rejects non-positive timeouts", () => {
		expect(() => createTimeoutPlugin({ timeoutMs: 0 })).toThrow();
		expect(() => createTimeoutPlugin({ timeoutMs: -5 })).toThrow();
		expect(() => createTimeoutPlugin({ timeoutMs: Number.NaN })).toThrow();
	});
});

describe("parse errors notify plugins", () => {
	it("notifies plugins when JSON parsing fails", async () => {
		const seen: unknown[] = [];
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				{
					name: "spy",
					onError(error) {
						seen.push(error);
					},
				},
			],
			transport: {
				async execute() {
					return new Response("not-json{{{", {
						headers: { "content-type": "application/json" },
					});
				},
			},
		});

		await expect(client.get("/a")).rejects.toThrow();
		expect(seen.length).toBe(1);
	});
});

describe("GraphQL envelope validation", () => {
	it("throws ApiError for a non-object envelope", async () => {
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: {
				async execute() {
					return jsonResponse([1, 2, 3]);
				},
			},
		});

		const err = await client
			.graphql("/graphql", { query: "{ viewer { id } }" })
			.then(
				() => null,
				(e: unknown) => e,
			);
		expect(err).toBeInstanceOf(ApiError);
		expect((err as ApiError).message).toContain("envelope");
	});

	it("fires onError for GraphQL application errors", async () => {
		const seen: unknown[] = [];
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				{
					name: "spy",
					onError(error) {
						seen.push(error);
					},
				},
			],
			transport: {
				async execute() {
					return jsonResponse({ errors: [{ message: "Denied" }] });
				},
			},
		});

		await expect(
			client.graphql("/graphql", { query: "{ viewer { id } }" }),
		).rejects.toBeInstanceOf(GraphQLRequestError);
		expect(seen.length).toBe(1);
		expect(seen[0]).toBeInstanceOf(GraphQLRequestError);
	});
});

describe("mergeHeaders hardening", () => {
	it("skips nullish values instead of stringifying them", () => {
		const result = mergeHeaders({ a: "1" }, {
			b: undefined,
			c: null,
		} as unknown as Record<string, string>);
		expect(result).toEqual({ a: "1" });
		expect("b" in result).toBe(false);
		expect("c" in result).toBe(false);
	});
});
