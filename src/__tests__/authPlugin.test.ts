import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import type { RequestContext } from "../context/RequestContext";
import { createAuthPlugin } from "../plugins/auth/authPlugin";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("createAuthPlugin", () => {
	it("injects a bearer token from an async provider", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [createAuthPlugin(async () => "token")],
			transport: {
				execute: async (ctx) => {
					captured = ctx;
					return jsonResponse({});
				},
			},
		});

		await client.get("/me");

		expect(captured?.headers.authorization).toBe("Bearer token");
	});

	it("can write raw token values to custom headers", async () => {
		let captured: RequestContext | undefined;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				createAuthPlugin({
					getToken: () => "abc",
					headerName: "x-api-key",
					scheme: null,
				}),
			],
			transport: {
				execute: async (ctx) => {
					captured = ctx;
					return jsonResponse({});
				},
			},
		});

		await client.get("/me");

		expect(captured?.headers["x-api-key"]).toBe("abc");
	});
});
