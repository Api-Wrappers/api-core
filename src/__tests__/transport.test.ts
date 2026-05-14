import { describe, expect, it } from "bun:test";
import type { RequestContext } from "../context/RequestContext";
import { TimeoutError } from "../errors/TimeoutError";
import {
	createFetchTransport,
	fetchTransport,
} from "../transport/fetchTransport";

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
	return {
		url: "https://api.test/v1",
		method: "POST",
		headers: { "content-type": "application/json" },
		meta: {},
		retryCount: 0,
		attempt: 0,
		...overrides,
	};
}

describe("fetchTransport", () => {
	it("sends string bodies without JSON stringifying them", async () => {
		let captured: RequestInit | undefined;
		const transport = createFetchTransport(async (_url, init) => {
			captured = init;
			return new Response("{}");
		});

		await transport.execute(
			makeCtx({
				headers: { "content-type": "text/plain" },
				body: "fields name;",
			}),
		);

		expect(captured?.body).toBe("fields name;");
	});

	it("serializes object bodies as JSON", async () => {
		let captured: RequestInit | undefined;
		const transport = createFetchTransport(async (_url, init) => {
			captured = init;
			return new Response("{}");
		});

		await transport.execute(
			makeCtx({ body: { query: "query { Viewer { id } }" } }),
		);

		expect(captured?.body).toBe('{"query":"query { Viewer { id } }"}');
	});

	it("detects structured JSON content types case-insensitively", async () => {
		let captured: RequestInit | undefined;
		const transport = createFetchTransport(async (_url, init) => {
			captured = init;
			return new Response("{}");
		});

		await transport.execute(
			makeCtx({
				headers: { "content-type": "Application/Problem+JSON" },
				body: new Date("2020-01-01T00:00:00.000Z"),
			}),
		);

		expect(captured?.body).toBe('"2020-01-01T00:00:00.000Z"');
	});

	it("resolves the default global fetch at execution time", async () => {
		const originalFetch = globalThis.fetch;
		let called = false;

		try {
			globalThis.fetch = (async () => {
				called = true;
				return new Response("{}");
			}) as unknown as typeof fetch;

			await fetchTransport.execute(makeCtx({ body: undefined, method: "GET" }));

			expect(called).toBe(true);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("throws TimeoutError when its own timeout aborts the request", async () => {
		const transport = createFetchTransport(
			() =>
				new Promise<Response>((_resolve, reject) => {
					const error = new Error("aborted");
					error.name = "AbortError";
					setTimeout(() => reject(error), 10);
				}),
		);

		await expect(
			transport.execute(makeCtx({ timeoutMs: 1 })),
		).rejects.toBeInstanceOf(TimeoutError);
	});
});
