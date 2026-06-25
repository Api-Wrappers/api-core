import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import { createLoggerPlugin } from "../plugins/logger/loggerPlugin";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("createLoggerPlugin", () => {
	it("does not log request bodies by default", async () => {
		const records: unknown[] = [];
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				createLoggerPlugin({
					logger: {
						info: (_message, data) => records.push(data),
						error: () => {},
					},
				}),
			],
			transport: {
				execute: async () => jsonResponse({ ok: true }),
			},
		});

		await client.post("/token", { refreshToken: "secret" });

		expect(records[0]).toEqual({ attempt: 0 });
	});

	it("logs redacted bodies only when logBody is enabled", async () => {
		const records: unknown[] = [];
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				createLoggerPlugin({
					logBody: true,
					redactBody: () => ({ refreshToken: "[redacted]" }),
					logger: {
						info: (_message, data) => records.push(data),
						error: () => {},
					},
				}),
			],
			transport: {
				execute: async () => jsonResponse({ ok: true }),
			},
		});

		await client.post("/token", { refreshToken: "secret" });

		expect(records[0]).toEqual({
			attempt: 0,
			body: { refreshToken: "[redacted]" },
		});
	});

	it("keeps error logging free of request body data", async () => {
		const errors: unknown[] = [];
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			plugins: [
				createLoggerPlugin({
					logger: {
						info: () => {},
						error: (_message, data) => errors.push(data),
					},
				}),
			],
			transport: {
				execute: async () => {
					throw new Error("network");
				},
			},
		});

		await expect(
			client.post("/token", { refreshToken: "secret" }),
		).rejects.toThrow("network");

		expect(errors[0]).toBeInstanceOf(Error);
	});
});
