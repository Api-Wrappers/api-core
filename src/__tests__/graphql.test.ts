import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import type { RequestContext } from "../context/RequestContext";
import { ApiError } from "../errors/ApiError";
import { RateLimitError } from "../errors/RateLimitError";
import { GraphQLRequestError } from "../graphql/GraphQLRequestError";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a transport whose `execute` fn is provided by the caller. */
function makeTransport(fn: (ctx: RequestContext) => Promise<Response>) {
	return { execute: fn };
}

/** Builds a well-formed JSON Response with the given body and status. */
function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const BASE = "https://api.test";
const PATH = "/graphql";
const QUERY = "query GetUser($id: ID!) { user(id: $id) { id name } }";

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("BaseHttpClient.graphql()", () => {
	// 1. Successful response ─────────────────────────────────────────────────

	it("returns the data field on a successful response", async () => {
		const client = new BaseHttpClient({
			baseUrl: BASE,
			transport: makeTransport(async () =>
				jsonResponse({ data: { user: { id: "1", name: "Alice" } } }),
			),
		});

		const result = await client.graphql<{ user: { id: string; name: string } }>(
			PATH,
			{ query: QUERY, variables: { id: "1" } },
		);

		expect(result.user.id).toBe("1");
		expect(result.user.name).toBe("Alice");
	});

	// 2. Request body shape ──────────────────────────────────────────────────

	it("sends query, variables, and operationName in the POST body", async () => {
		let captured: RequestContext | undefined;

		const client = new BaseHttpClient({
			baseUrl: BASE,
			transport: makeTransport(async (ctx) => {
				captured = ctx;
				return jsonResponse({ data: {} });
			}),
		});

		await client.graphql(PATH, {
			query: QUERY,
			variables: { id: "42" },
			operationName: "GetUser",
		});

		expect(captured?.method).toBe("POST");
		const body = captured?.body as Record<string, unknown>;
		expect(body.query).toBe(QUERY);
		expect(body.variables).toEqual({ id: "42" });
		expect(body.operationName).toBe("GetUser");
	});

	it("omits variables and operationName from the body when not provided", async () => {
		let captured: RequestContext | undefined;

		const client = new BaseHttpClient({
			baseUrl: BASE,
			transport: makeTransport(async (ctx) => {
				captured = ctx;
				return jsonResponse({ data: {} });
			}),
		});

		await client.graphql(PATH, { query: QUERY });

		const body = captured?.body as Record<string, unknown>;
		expect(body.query).toBe(QUERY);
		expect(Object.hasOwn(body, "variables")).toBe(false);
		expect(Object.hasOwn(body, "operationName")).toBe(false);
	});

	// 3. Headers / content-type ──────────────────────────────────────────────

	it("always includes content-type: application/json", async () => {
		let captured: RequestContext | undefined;

		const client = new BaseHttpClient({
			baseUrl: BASE,
			transport: makeTransport(async (ctx) => {
				captured = ctx;
				return jsonResponse({ data: {} });
			}),
		});

		await client.graphql(PATH, { query: QUERY });

		expect(captured?.headers["content-type"]).toBe("application/json");
	});

	it("merges per-request headers over defaultHeaders", async () => {
		let captured: RequestContext | undefined;

		const client = new BaseHttpClient({
			baseUrl: BASE,
			defaultHeaders: { "x-tenant": "acme", "x-version": "1" },
			transport: makeTransport(async (ctx) => {
				captured = ctx;
				return jsonResponse({ data: {} });
			}),
		});

		// per-request header overrides the default value for the same key
		await client.graphql(PATH, {
			query: QUERY,
			headers: { "x-version": "2" },
		});

		expect(captured?.headers["x-tenant"]).toBe("acme");
		expect(captured?.headers["x-version"]).toBe("2");
	});

	// 4. GraphQL application-layer errors ────────────────────────────────────

	it("throws GraphQLRequestError when the response contains errors", async () => {
		const client = new BaseHttpClient({
			baseUrl: BASE,
			transport: makeTransport(async () =>
				// HTTP 200 with both data and errors (partial result)
				jsonResponse({
					data: { user: null },
					errors: [
						{ message: "User not found", path: ["user"] },
						{ message: "Permission denied", path: ["user"] },
					],
				}),
			),
		});

		await expect(
			client.graphql(PATH, { query: QUERY, variables: { id: "99" } }),
		).rejects.toBeInstanceOf(GraphQLRequestError);
	});

	it("attaches graphqlErrors array and partialData to the thrown error", async () => {
		const partial = { user: null };
		const client = new BaseHttpClient({
			baseUrl: BASE,
			transport: makeTransport(async () =>
				jsonResponse({
					data: partial,
					errors: [{ message: "User not found", path: ["user"] }],
				}),
			),
		});

		let caught: GraphQLRequestError | undefined;
		try {
			await client.graphql(PATH, { query: QUERY });
		} catch (err) {
			if (err instanceof GraphQLRequestError) caught = err;
		}

		expect(caught).toBeDefined();
		expect(caught?.graphqlErrors).toHaveLength(1);
		expect(caught?.graphqlErrors[0]?.message).toBe("User not found");
		expect(caught?.graphqlErrors[0]?.path).toEqual(["user"]);
		expect(caught?.partialData).toEqual(partial);
	});

	it("GraphQLRequestError is also an instanceof ApiError", async () => {
		const client = new BaseHttpClient({
			baseUrl: BASE,
			transport: makeTransport(async () =>
				jsonResponse({ errors: [{ message: "boom" }] }),
			),
		});

		await expect(client.graphql(PATH, { query: QUERY })).rejects.toBeInstanceOf(
			ApiError,
		);
	});

	// 5. HTTP-level failures ─────────────────────────────────────────────────

	it("throws RateLimitError on HTTP 429", async () => {
		const client = new BaseHttpClient({
			baseUrl: BASE,
			transport: makeTransport(async () => new Response(null, { status: 429 })),
		});

		await expect(client.graphql(PATH, { query: QUERY })).rejects.toBeInstanceOf(
			RateLimitError,
		);
	});

	it("throws ApiError on HTTP 500", async () => {
		const client = new BaseHttpClient({
			baseUrl: BASE,
			transport: makeTransport(async () =>
				jsonResponse({ message: "internal error" }, 500),
			),
		});

		let caught: ApiError | undefined;
		try {
			await client.graphql(PATH, { query: QUERY });
		} catch (err) {
			if (err instanceof ApiError) caught = err;
		}

		expect(caught).toBeInstanceOf(ApiError);
		expect(caught?.status).toBe(500);
	});
});
