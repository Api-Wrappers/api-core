# @api-wrappers/api-core

Shared TypeScript HTTP runtime for API wrapper libraries.

`@api-wrappers/api-core` gives wrapper packages a small, predictable foundation
for request execution, retries, timeouts, auth headers, caching, rate limiting,
GraphQL requests, custom transports, and plugin-based request/response
middleware.

It is designed for packages that expose domain-specific clients while keeping
their internal HTTP layer consistent and testable.

## Features

- Typed REST helpers: `get`, `post`, `put`, `patch`, `delete`, `head`,
  `options`, and `request`.
- `requestWithResponse` for wrappers that need response headers, status, or
  plugin metadata.
- GraphQL helper with typed `data` and `variables`.
- Deterministic plugin lifecycle with `setup`, `beforeRequest`,
  `afterResponse`, `onError`, and `dispose`.
- Built-in auth, cache, logger, rate-limit, retry, and timeout plugins.
- Fetch transport with JSON bodies, raw string bodies, abort signals, and
  timeout handling.
- Response parsing for JSON, text, and binary payloads.
- Query string support for primitives and repeated array values.
- ESM and CommonJS builds with TypeScript declarations.

## Requirements

- TypeScript 5+
- A runtime with `fetch`, `Request`, `Response`, and `AbortController`
  available. Modern Node, Bun, browsers, and edge runtimes satisfy this.
- For older runtimes, pass a custom `fetch` implementation or a full custom
  `Transport`.

## Installation

```bash
bun add @api-wrappers/api-core
```

```bash
npm install @api-wrappers/api-core
```

## Quick Start

```ts
import {
	createAuthPlugin,
	createClient,
	createRetryPlugin,
	createTimeoutPlugin,
} from "@api-wrappers/api-core";

interface User {
	id: string;
	name: string;
}

const client = createClient({
	baseUrl: "https://api.example.com/v1",
	defaultHeaders: { accept: "application/json" },
	plugins: [
		createAuthPlugin(() => process.env.API_TOKEN),
		createRetryPlugin({ maxAttempts: 3, delayMs: 300 }),
		createTimeoutPlugin({ timeoutMs: 30_000 }),
	],
});

const user = await client.get<User>("/users/123");
```

`baseUrl` and request paths are slash-safe:

```ts
client.get("/users");
client.get("users");
```

Both work with `baseUrl: "https://api.example.com/v1/"`.

## Client Configuration

```ts
import { createClient } from "@api-wrappers/api-core";

const client = createClient({
	baseUrl: "https://api.example.com",
	defaultHeaders: {
		accept: "application/json",
	},
	timeoutMs: 10_000,
	retry: {
		maxAttempts: 2,
		delayMs: 250,
		jitter: true,
		retriableStatusCodes: [429, 500, 502, 503, 504],
	},
	plugins: [],
	logger: console,
});
```

| Option | Purpose |
| --- | --- |
| `baseUrl` | Base URL prepended to relative request paths. |
| `defaultHeaders` | Headers merged into every request. Per-request headers win. |
| `timeoutMs` | Default request timeout. Can be overridden per request. |
| `retry` | Global retry policy. Can be overridden by `createRetryPlugin`. |
| `plugins` | Plugin list for auth, cache, logging, rate limiting, etc. |
| `transport` | Full request executor override, useful in tests. |
| `fetch` | Custom fetch implementation used by the default transport. |
| `logger` | Internal diagnostics logger. Defaults to `console`. |

## Requests

```ts
await client.get<SearchResult>("/search", {
	query: {
		q: "alien",
		page: 2,
		with_genres: [878, 12],
		skip: undefined,
	},
	headers: { accept: "application/json" },
	timeoutMs: 5_000,
	signal: abortController.signal,
	tags: ["search"],
	cacheKey: "search:alien:2",
});
```

Query values can be strings, numbers, booleans, nullish values, or arrays of
those primitives. `null` and `undefined` are skipped. Arrays are encoded as
repeated query parameters:

```txt
?with_genres=878&with_genres=12
```

### Request Methods

```ts
client.get<T>(path, options);
client.post<T>(path, body, options);
client.put<T>(path, body, options);
client.patch<T>(path, body, options);
client.delete<T>(path, options);
client.head<T>(path, options);
client.options<T>(path, options);
client.request<T>(path, { method: "POST", body });
```

Plain objects and arrays are JSON encoded. Strings and native `BodyInit`
values are sent as-is, which supports APIs that expect text query languages:

```ts
const games = await client.post<Game[]>(
	"/games",
	"fields name,rating; limit 10;",
	{
		headers: {
			"content-type": "text/plain",
			accept: "application/json",
		},
	},
);
```

Binary responses can stay on the shared request path by selecting an explicit
response type:

```ts
const bytes = await client.post<ArrayBuffer>("/games.pb", query, {
	headers: { accept: "application/octet-stream" },
	responseType: "arrayBuffer",
});
```

### Response Metadata

Use `requestWithResponse` when a wrapper needs more than the parsed body:

```ts
const result = await client.requestWithResponse<MoviePage>("/movie/popular");

result.data;
result.response.status;
result.response.headers.get("x-ratelimit-remaining");
result.request.url;
result.meta["cache.served"];
```

## GraphQL

```ts
interface GetMediaQuery {
	Media: { id: number; title: { romaji: string } };
}

interface GetMediaVariables {
	id: number;
}

const data = await client.graphql<GetMediaQuery, GetMediaVariables>("/", {
	query: `
		query GetMedia($id: Int) {
			Media(id: $id) { id title { romaji } }
		}
	`,
	variables: { id: 1 },
	operationName: "GetMedia",
});

console.log(data.Media.title.romaji);
```

GraphQL uses the same transport, plugin lifecycle, retry policy, timeout
handling, and error classes as REST requests.

## Built-In Plugins

Plugins are ordinary objects that run through a deterministic lifecycle. Lower
priority values run earlier in `beforeRequest`; higher values run earlier in
`afterResponse`.

### Auth

```ts
createAuthPlugin("static-token");
createAuthPlugin(() => tokenStore.getAccessToken());
createAuthPlugin({
	getToken: () => apiKey,
	headerName: "x-api-key",
	scheme: null,
});
```

The default header is:

```txt
authorization: Bearer <token>
```

### Retry

```ts
createRetryPlugin({
	maxAttempts: 3,
	delayMs: 300,
	jitter: true,
	retriableStatusCodes: [429, 500, 502, 503, 504],
});
```

`429` responses respect `retry-after` when present. Numeric values are treated
as seconds; HTTP-date values are also supported.

### Timeout

```ts
createTimeoutPlugin({ timeoutMs: 30_000 });
```

Timeouts throw `TimeoutError`.

### Rate Limit

```ts
createRateLimitPlugin({
	maxConcurrent: 4,
	minTimeMs: 250,
});
```

```ts
createRateLimitPlugin({
	maxRequestsPerInterval: 30,
	intervalMs: 60_000,
});
```

The limiter releases slots on successful responses, transport failures, and
plugin failures.

### Cache

```ts
import { createCachePlugin, MemoryStore } from "@api-wrappers/api-core";

const cache = createCachePlugin({
	store: new MemoryStore(),
	ttlMs: 60_000,
	methods: ["GET"],
});

const client = createClient({
	baseUrl: "https://api.example.com",
	plugins: [cache],
});

await client.get("/users/1", { tags: ["user"] });
await cache.invalidate("GET:https://api.example.com/users/1");
await cache.invalidateByTag("user");
```

Cache hits skip the transport and set `meta["cache.served"]`.

### Logger

```ts
createLoggerPlugin({
	logRequest: true,
	logResponse: true,
	logError: true,
	logger: console,
});
```

Pass a structured logger or no-op logger to control diagnostics.

## Custom Plugins

```ts
import type { ApiPlugin } from "@api-wrappers/api-core";

export function createClientIdPlugin(clientId: string): ApiPlugin {
	return {
		name: "client-id",
		priority: 2,
		beforeRequest(ctx) {
			return {
				...ctx,
				headers: {
					...ctx.headers,
					"client-id": clientId,
				},
			};
		},
	};
}
```

Hooks may return a new context or `undefined` to keep the current one.

| Hook | When it runs |
| --- | --- |
| `setup(client)` | Once, lazily before the first request. |
| `beforeRequest(ctx)` | Before transport execution. |
| `afterResponse(ctx)` | After response parsing. |
| `onError(error, ctx)` | For transport, HTTP, and plugin failures. |
| `dispose()` | When `client.dispose()` is called. |

Read [docs/guides/plugins.md](docs/guides/plugins.md) for the full plugin
contract.

## Error Handling

```ts
import {
	ApiError,
	GraphQLRequestError,
	RateLimitError,
	TimeoutError,
} from "@api-wrappers/api-core";

try {
	await client.get("/resource");
} catch (error) {
	if (error instanceof RateLimitError) {
		console.log(error.retryAfterMs);
	} else if (error instanceof TimeoutError) {
		console.log("timed out");
	} else if (error instanceof GraphQLRequestError) {
		console.log(error.graphqlErrors);
	} else if (error instanceof ApiError) {
		console.log(error.status, error.responseBody);
	}
}
```

| Error | Meaning |
| --- | --- |
| `ApiError` | Non-2xx HTTP response after retries are exhausted. |
| `RateLimitError` | HTTP 429 response. Includes `retryAfterMs` when available. |
| `TimeoutError` | Request exceeded timeout. |
| `GraphQLRequestError` | GraphQL response contained an `errors` array. |

## Testing

Use a custom transport for deterministic tests:

```ts
import { BaseHttpClient } from "@api-wrappers/api-core";

const client = new BaseHttpClient({
	baseUrl: "https://api.example.com",
	transport: {
		execute: async (ctx) =>
			new Response(JSON.stringify({ url: ctx.url }), {
				headers: { "content-type": "application/json" },
			}),
	},
});
```

This exercises the client, request options, plugins, and error handling without
making network calls.

## Package Exports

```ts
import {
	ApiError,
	BaseHttpClient,
	createAuthPlugin,
	createCachePlugin,
	createClient,
	createLoggerPlugin,
	createRateLimitPlugin,
	createRetryPlugin,
	createTimeoutPlugin,
	gql,
	GraphQLRequestError,
	MemoryStore,
	RateLimitError,
	TimeoutError,
} from "@api-wrappers/api-core";

import type {
	ApiPlugin,
	ApiResponse,
	ClientConfig,
	QueryParams,
	RequestContext,
	RequestOptions,
	ResponseContext,
	Transport,
} from "@api-wrappers/api-core";
```

The package publishes:

- ESM: `dist/index.mjs`
- CommonJS: `dist/index.cjs`
- Type declarations for both module formats
- README and docs

## More Documentation

- [Documentation home](docs/README.md): recommended reading order and full docs
  map.
- [Getting started](docs/getting-started.md): install, create a client, and make
  the first request.
- [REST requests](docs/guides/rest-requests.md): methods, query params, request
  bodies, abort signals, and response metadata.
- [Built-in plugins](docs/guides/built-in-plugins.md): auth, retry, timeout,
  rate-limit, cache, and logger usage.
- [Client API reference](docs/reference/client.md): client methods and response
  shapes.

## Development

```bash
bun install
bun run check
bun test
bun run build
npm pack --dry-run
```

`dist` is generated by `tsdown`. The published package includes `dist`, `docs`,
`README.md`, and `package.json`.
