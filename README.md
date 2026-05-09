# @api-wrappers/api-core

Shared HTTP runtime for the wrapper projects in this workspace. It provides a
small typed client, a plugin pipeline, fetch-based transport, common error
types, GraphQL support, and built-in plugins for auth, cache, retry, logging,
timeouts, and rate limiting.

The intended use is internal to wrapper packages: keep each wrapper's public
client and endpoint classes, and replace only the repeated HTTP plumbing.

## Install

For local workspace adoption:

```bash
bun add ../api-core
```

For registry adoption after publishing:

```bash
bun add @api-wrappers/api-core
npm install @api-wrappers/api-core
```

## Basic REST Client

```ts
import {
	createAuthPlugin,
	createClient,
	createRetryPlugin,
	createTimeoutPlugin,
} from "@api-wrappers/api-core";

const client = createClient({
	baseUrl: "https://api.example.com/v1",
	defaultHeaders: { accept: "application/json" },
	plugins: [
		createAuthPlugin(() => authManager.getAccessToken()),
		createRetryPlugin({ maxAttempts: 3, delayMs: 300 }),
		createTimeoutPlugin({ timeoutMs: 30_000 }),
	],
});

const user = await client.get<User>("/users/1");
```

`baseUrl` and request paths are slash-safe. These calls produce the same URL:

```ts
createClient({ baseUrl: "https://api.example.com/v1/" }).get("/users");
createClient({ baseUrl: "https://api.example.com/v1" }).get("users");
```

## Request Options

All request methods accept common options:

```ts
await client.get<SearchResult>("/search", {
	query: {
		q: "alien",
		page: 2,
		with_genres: [878, 12],
		skip: undefined,
	},
	headers: { accept: "application/json" },
	timeoutMs: 10_000,
	signal: abortController.signal,
	tags: ["search"],
	cacheKey: "search:alien:2",
});
```

Query arrays are emitted as repeated parameters, and `null` or `undefined`
values are skipped.

## Raw Response Access

Use `requestWithResponse` when a wrapper needs status, headers, or plugin
metadata:

```ts
const result = await client.requestWithResponse<MoviePage>("/movie/popular");

console.log(result.data.results);
console.log(result.response.headers.get("x-ratelimit-remaining"));
console.log(result.meta["cache.served"]);
```

`request()` and the convenience methods return only `data`.

## Text Body APIs

String bodies are sent as-is. This supports APIs like IGDB that expect APICalypse
query text instead of JSON:

```ts
const games = await client.post<Game[]>("/games", "fields name,rating; limit 10;", {
	headers: {
		"content-type": "text/plain",
		accept: "application/json",
	},
});
```

Plain objects and arrays are JSON encoded by default.

## GraphQL

```ts
const data = await client.graphql<GetUserQuery, GetUserVariables>("/graphql", {
	query: GET_USER,
	variables: { id: 1 },
	operationName: "GetUser",
	cacheKey: "gql:GetUser:1",
});
```

HTTP failures throw `ApiError`, `RateLimitError`, or `TimeoutError`.
GraphQL responses with an `errors` array throw `GraphQLRequestError`, which also
extends `ApiError`.

## Built-In Plugins

```ts
import {
	createAuthPlugin,
	createCachePlugin,
	createLoggerPlugin,
	createRateLimitPlugin,
	createRetryPlugin,
	createTimeoutPlugin,
	MemoryStore,
} from "@api-wrappers/api-core";

const cache = createCachePlugin({
	store: new MemoryStore(),
	ttlMs: 60_000,
});

const client = createClient({
	baseUrl: "https://api.example.com",
	plugins: [
		createRateLimitPlugin({ maxConcurrent: 4, minTimeMs: 250 }),
		createAuthPlugin(() => authManager.getAccessToken()),
		createRetryPlugin({ maxAttempts: 3, delayMs: 250 }),
		createLoggerPlugin({ logRequest: false }),
		cache,
		createTimeoutPlugin({ timeoutMs: 30_000 }),
	],
});
```

Plugin priority is deterministic:

| Hook | Order |
| --- | --- |
| `beforeRequest` | Lower priority first |
| `afterResponse` | Higher priority first |
| `onError` | Registered plugin order |
| `dispose` | Higher priority first |

## Wrapper Adoption

Keep endpoint/service classes unchanged and replace each wrapper's private HTTP
client internals with `BaseHttpClient` or `createClient`.

See:

- [Adoption Guide](docs/adoption.md)
- [Plugin Guide](docs/plugins.md)

## Public Exports

Core:

- `createClient`
- `BaseHttpClient`
- `RequestOptions`
- `ApiResponse`
- `ClientConfig`
- `Transport`
- `RequestContext`
- `ResponseContext`

Errors:

- `ApiError`
- `RateLimitError`
- `TimeoutError`
- `GraphQLRequestError`

Plugins:

- `ApiPlugin`
- `createAuthPlugin`
- `createCachePlugin`
- `MemoryStore`
- `createLoggerPlugin`
- `createRateLimitPlugin`
- `createRetryPlugin`
- `createTimeoutPlugin`

Utilities and types:

- `buildUrl`
- `resolveUrl`
- `mergeHeaders`
- `sleep`
- `HttpMethod`
- `QueryParams`
- `QueryValue`

## Build And Verify

```bash
bun run check
bun test
bun run build
npm pack --dry-run
```

The package ships `dist` only. Build output includes ESM, CommonJS, and matching
TypeScript declarations.
