import { describe, expect, it } from "bun:test";
import { BaseHttpClient } from "../client/BaseHttpClient";
import type { RequestContext } from "../context/RequestContext";
import { createGraphQLRequester } from "../graphql/createGraphQLRequester";

const DOCUMENT = "query Media($id: Int) { Media(id: $id) { id } }";

describe("createGraphQLRequester", () => {
	it("maps generated SDK request fields to api-core GraphQL options", async () => {
		let captured: RequestContext | undefined;
		const signal = new AbortController().signal;
		const client = new BaseHttpClient({
			baseUrl: "https://api.test",
			transport: {
				async execute(ctx) {
					captured = ctx;
					return new Response(
						JSON.stringify({ data: { Media: { id: 1 } } }),
						{ headers: { "content-type": "application/json" } },
					);
				},
			},
		});
		const requester = createGraphQLRequester(client, {
			path: "/graphql",
			transformDocument: (document) => document.trim(),
		});

		const result = await requester.request<
			{ Media: { id: number } },
			{ id: number }
		>({
			document: ` ${DOCUMENT} `,
			variables: { id: 1 },
			requestHeaders: { "x-client": "generated" },
			signal,
			operationName: "Media",
			timeoutMs: 5_000,
			cacheKey: "media:1",
			tags: ["media"],
		});

		expect(result).toEqual({ Media: { id: 1 } });
		expect(captured?.url).toBe("https://api.test/graphql");
		expect(captured?.method).toBe("POST");
		expect(captured?.body).toEqual({
			query: DOCUMENT,
			variables: { id: 1 },
			operationName: "Media",
		});
		expect(captured?.headers["x-client"]).toBe("generated");
		expect(captured?.signal).toBe(signal);
		expect(captured?.timeoutMs).toBe(5_000);
		expect(captured?.cacheKey).toBe("media:1");
		expect(captured?.tags).toEqual(["media"]);
	});
});
