# Examples

These examples show the supported `api-core` runtime surface for wrapper
authors and direct users. They use the exported client, plugin, GraphQL, and
transport APIs without relying on provider-specific behavior.

## Basic REST client

```ts
import { createClient } from "@api-wrappers/api-core";

interface SearchItem {
	id: string;
	name: string;
}

interface SearchResponse {
	page: number;
	results: Array<SearchItem>;
}

const client = createClient({
	baseUrl: "https://api.example.com/v1",
	defaultHeaders: { accept: "application/json" },
});

const response = await client.get<SearchResponse>("/search", {
	query: {
		q: "space",
		page: 1,
	},
});

console.log(response.results);
```

## Auth, retry, and timeout

```ts
import {
	createAuthPlugin,
	createClient,
	createRetryPlugin,
	createTimeoutPlugin,
} from "@api-wrappers/api-core";

const client = createClient({
	baseUrl: "https://api.example.com/v1",
	plugins: [
		createAuthPlugin(() => process.env.API_TOKEN),
		createRetryPlugin({
			maxAttempts: 3,
			delayMs: 300,
			jitter: true,
			retriableStatusCodes: [429, 500, 502, 503, 504],
		}),
		createTimeoutPlugin({ timeoutMs: 10_000 }),
	],
});

await client.get("/account");
```

## Response metadata

Use `requestWithResponse` when a wrapper needs headers, status, request details,
or plugin metadata in addition to the parsed body.

```ts
import { createClient } from "@api-wrappers/api-core";

interface Page {
	items: Array<{ id: string }>;
}

const client = createClient({
	baseUrl: "https://api.example.com/v1",
});

const result = await client.requestWithResponse<Page>("/items", {
	query: { page: 1 },
});

console.log(result.data.items);
console.log(result.response.status);
console.log(result.response.headers.get("x-ratelimit-remaining"));
console.log(result.request.url);
console.log(result.meta);
```

## GraphQL request

```ts
import { createClient, gql } from "@api-wrappers/api-core";

interface ViewerQuery {
	Viewer: {
		id: number;
		name: string;
	};
}

const client = createClient({
	baseUrl: "https://graphql.example.com",
});

const data = await client.graphql<ViewerQuery>("/", {
	query: gql`
		query Viewer {
			Viewer {
				id
				name
			}
		}
	`,
});

console.log(data.Viewer.name);
```

## Custom plugin

Plugins can mutate request context before transport execution, inspect parsed
responses, and observe pipeline errors.

```ts
import { createClient } from "@api-wrappers/api-core";
import type { ApiPlugin } from "@api-wrappers/api-core";

const createClientIdPlugin = (clientId: string): ApiPlugin => ({
	name: "client-id",
	priority: 5,
	beforeRequest(ctx) {
		return {
			...ctx,
			headers: {
				...ctx.headers,
				"client-id": clientId,
			},
		};
	},
});

const client = createClient({
	baseUrl: "https://api.example.com/v1",
	plugins: [createClientIdPlugin("wrapper-name")],
});
```

## Custom fetch

Use `fetch` when you only need to swap or wrap the fetch implementation used by
the default transport.

```ts
import { createClient } from "@api-wrappers/api-core";
import type { FetchLike } from "@api-wrappers/api-core";

const tracedFetch: FetchLike = async (input, init) => {
	console.log("request", input);
	return fetch(input, init);
};

const client = createClient({
	baseUrl: "https://api.example.com/v1",
	fetch: tracedFetch,
});
```

## Custom transport for tests

Use `transport` when tests need full control over execution without real
network calls.

```ts
import { createClient } from "@api-wrappers/api-core";
import type { Transport } from "@api-wrappers/api-core";

const testTransport: Transport = {
	async execute(ctx) {
		return new Response(
			JSON.stringify({
				url: ctx.url,
				method: ctx.method,
			}),
			{ headers: { "content-type": "application/json" } },
		);
	},
};

const client = createClient({
	baseUrl: "https://api.example.com/v1",
	transport: testTransport,
});

const echo = await client.get<{ url: string; method: string }>("/status");
console.log(echo);
```

## Error handling with guards

Catch values are `unknown` in strict TypeScript. Use the exported guards to
narrow `api-core` errors.

```ts
import {
	isApiError,
	isGraphQLRequestError,
	isRateLimitError,
	isTimeoutError,
} from "@api-wrappers/api-core";

try {
	await client.get("/resource");
} catch (error: unknown) {
	if (isRateLimitError(error)) {
		console.log(error.retryAfterMs);
	} else if (isTimeoutError(error)) {
		console.log("request timed out");
	} else if (isGraphQLRequestError(error)) {
		console.log(error.graphqlErrors);
	} else if (isApiError(error)) {
		console.log(error.status, error.responseBody);
	} else {
		throw error;
	}
}
```
