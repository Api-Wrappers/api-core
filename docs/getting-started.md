# Getting Started

This guide shows the shortest path from installation to a typed API request.

## Install

```bash
bun add @api-wrappers/api-core
```

```bash
npm install @api-wrappers/api-core
```

## Create A Client

```ts
import {
	createAuthPlugin,
	createClient,
	createRetryPlugin,
	createTimeoutPlugin,
} from "@api-wrappers/api-core";

const client = createClient({
	baseUrl: "https://api.example.com/v1",
	defaultHeaders: {
		accept: "application/json",
	},
	plugins: [
		createAuthPlugin(() => process.env.API_TOKEN),
		createRetryPlugin({ maxAttempts: 3, delayMs: 300 }),
		createTimeoutPlugin({ timeoutMs: 30_000 }),
	],
});
```

## Make A Request

```ts
interface User {
	id: string;
	name: string;
}

const user = await client.get<User>("/users/123");
```

The returned value is the parsed response body. JSON responses are parsed into
objects; non-JSON responses are returned as text; empty `204` or `205` responses
return `undefined`.

## Add Query Parameters

```ts
const results = await client.get<SearchResults>("/search", {
	query: {
		q: "alien",
		page: 2,
		with_genres: [878, 12],
	},
});
```

Array values are encoded as repeated query parameters:

```txt
?q=alien&page=2&with_genres=878&with_genres=12
```

## Send A Body

Plain objects and arrays are JSON encoded:

```ts
await client.post("/users", {
	name: "Ada Lovelace",
});
```

Strings are sent as-is:

```ts
await client.post("/games", "fields name,rating; limit 10;", {
	headers: { "content-type": "text/plain" },
});
```

## Next Steps

- [REST Requests](guides/rest-requests.md)
- [Built-In Plugins](guides/built-in-plugins.md)
- [Error Handling](guides/error-handling.md)
