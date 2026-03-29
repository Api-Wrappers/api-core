# @tdanks2000/api-core

Shared HTTP client runtime for the `api-wrappers` organisation. Provides
request orchestration, a plugin lifecycle, transport abstraction, built-in
cache/retry/logger plugins, and shared error classes.

---

## Install

```bash
bun add @tdanks2000/api-core
# or
npm install @tdanks2000/api-core
```

---

## Quick start

```ts
import { createClient, createLoggerPlugin, createCachePlugin } from "@tdanks2000/api-core";

const client = createClient({
  baseUrl: "https://api.example.com/v1",
  defaultHeaders: { "x-api-key": "your-key" },
  plugins: [
    createLoggerPlugin(),
    createCachePlugin({ ttlMs: 60_000 }),
  ],
  retry: { maxAttempts: 3, delayMs: 500 },
});

const data = await client.get<MyType>("/endpoint", { query: { page: 1 } });
```

> **Note:** `content-type: application/json` is set on every request by
> default. Override it with a `beforeRequest` plugin or per-request
> `headers` option.

---

## Request lifecycle

```
setup (once, on first request)
  └─ beforeRequest  (ascending priority — lower number runs first)
       └─ transport.execute  (skipped on a cache hit)
            └─ afterResponse  (descending priority — higher number runs first)
                 └─ onError   (all plugins, on any failure)
```

- `beforeRequest` and `afterResponse` each receive the full context object
  and may return a mutated copy. Returning `void` keeps the existing context.
- `onError` fires for transport errors, non-2xx responses after all retries
  are exhausted, and plugin hook failures. Individual `onError` handler
  failures are caught and logged without interrupting other handlers.
- `setup` is called lazily on the first request, not in the constructor.

---

## Plugin priority

| Priority value | Runs in `beforeRequest` | Runs in `afterResponse` |
|----------------|------------------------|------------------------|
| Lower (e.g. 1) | Earlier | Later |
| Higher (e.g. 200) | Later | Earlier |

Built-in plugin defaults:

| Plugin | Priority |
|--------|----------|
| `createRetryPlugin` | 5 |
| `createLoggerPlugin` | 10 |
| `createCachePlugin` | 20 |

Plugins with equal priority run in registration order.

---

## Error types

| Class | Thrown when | Key fields |
|-------|-------------|------------|
| `ApiError` | Non-2xx response after all retries | `status`, `responseBody`, `cause` |
| `RateLimitError extends ApiError` | HTTP 429 | `retryAfterMs` (when server sends `retry-after`) |
| `TimeoutError` | `timeoutMs` exceeded | `cause` (original `AbortError`) |

```ts
import { ApiError, RateLimitError, TimeoutError } from "@tdanks2000/api-core";

try {
  await client.get("/resource");
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log("back off for", err.retryAfterMs, "ms");
  } else if (err instanceof ApiError) {
    console.log("HTTP", err.status, err.responseBody);
  } else if (err instanceof TimeoutError) {
    console.log("timed out:", err.message);
  }
}
```

---

## Retry

Global retry config lives on `ClientConfig.retry`. Per-request overrides
are possible via `createRetryPlugin` — only the fields you provide are
overridden; anything omitted falls through to the global config.

```ts
import { createClient, createRetryPlugin } from "@tdanks2000/api-core";

const client = createClient({
  baseUrl: "https://api.example.com/v1",
  retry: { maxAttempts: 2, delayMs: 200 }, // global default
  plugins: [
    // This one request type gets 5 attempts instead of 2:
    createRetryPlugin({ maxAttempts: 5 }),
  ],
});
```

Retry delay uses **exponential backoff**: `delayMs × 2^attempt`. When
`jitter: true` (the default) a random multiplier in `[0.5, 1)` is applied
so parallel clients do not all retry simultaneously.

For `429` responses the client reads the `retry-after` header (in seconds)
and waits that long before the next attempt, ignoring the backoff formula.

---

## Cache

`createCachePlugin` caches **GET requests only** by default. The cache key
is derived from the HTTP method, full URL, and query string. Provide
`options.methods` to cache other idempotent verbs.

```ts
import { createCachePlugin, MemoryStore } from "@tdanks2000/api-core";

const store = new MemoryStore();

const plugin = createCachePlugin({
  store,           // default: a new MemoryStore()
  ttlMs: 30_000,   // default: no expiry
  // methods: ["GET", "HEAD"],  // default: ["GET"]
  // generateKey: (ctx) => `${ctx.method}:${ctx.url}`,
});
```

On a **cache hit** the transport is skipped entirely — no network call is
made. The `afterResponse` hook still runs so response-transformation plugins
see a consistent context. `ctx.meta["cache.served"]` is set to `true`.

On a **cache miss** the response is stored after a successful transport call.
`ctx.meta["cache.stored"]` is set to `true`.

Pass `cacheKey` in `RequestOptions` to use an explicit key instead of the
auto-generated one:

```ts
await client.get("/users/1", { cacheKey: "user:1" });
```

---

## Timeout plugin

`createTimeoutPlugin` stamps `timeoutMs` on every request context. Useful when
you want a global timeout via the plugin system rather than `ClientConfig.timeoutMs`,
or when the timeout value is loaded asynchronously in `setup`.

```ts
import { createClient, createTimeoutPlugin } from "@tdanks2000/api-core";

const client = createClient({
  baseUrl: "https://api.example.com",
  plugins: [createTimeoutPlugin({ timeoutMs: 5_000 })],
});
```

The actual abort is handled by `fetchTransport`; a `TimeoutError` is thrown
when the limit is exceeded.

---

## GraphQL

`client.graphql()` sends a GraphQL query or mutation to a single endpoint
path. It uses the same transport, plugin lifecycle, and retry behaviour as
every other request.

### Basic usage

```ts
import { createClient } from "@tdanks2000/api-core";

const client = createClient({ baseUrl: "https://api.example.com" });

// Untyped — data is `unknown`
const data = await client.graphql("/graphql", {
  query: `query { viewer { login } }`,
});
```

### Typed query and variables

Define the response shape and variables shape, then pass them as type
parameters:

```ts
interface GetUserQuery {
  user: { id: string; name: string; email: string };
}

interface GetUserQueryVariables {
  id: string;
}

const GET_USER = `
  query GetUser($id: ID!) {
    user(id: $id) { id name email }
  }
`;

const result = await client.graphql<GetUserQuery, GetUserQueryVariables>(
  "/graphql",
  { query: GET_USER, variables: { id: "42" } },
);

console.log(result.user.name); // fully typed
```

### Mutations

```ts
interface CreatePostMutation {
  createPost: { id: string; title: string };
}

const data = await client.graphql<CreatePostMutation>("/graphql", {
  query: `mutation CreatePost($title: String!) { createPost(title: $title) { id title } }`,
  variables: { title: "Hello" },
  operationName: "CreatePost",
});
```

### Error handling

HTTP-level failures (429, 500, timeout) throw the same classes as REST:
`RateLimitError`, `ApiError`, `TimeoutError`.

Application-layer errors — a 200 response whose body contains an `errors`
array — throw `GraphQLRequestError`, which extends `ApiError`:

```ts
import { GraphQLRequestError, ApiError } from "@tdanks2000/api-core";

try {
  await client.graphql("/graphql", { query: QUERY });
} catch (err) {
  if (err instanceof GraphQLRequestError) {
    // GraphQL application-layer error (HTTP 200 + errors array)
    for (const e of err.graphqlErrors) {
      console.error(e.message, e.path);
    }
    // Partial data is available if the server returned it alongside errors:
    console.log(err.partialData);
  } else if (err instanceof ApiError) {
    // HTTP-level failure (4xx / 5xx)
    console.error(err.status, err.responseBody);
  }
}
```

### Caching a GraphQL operation

The cache plugin skips `POST` requests by default. Pass an explicit
`cacheKey` to opt a specific operation into caching:

```ts
const data = await client.graphql<GetUserQuery>("/graphql", {
  query: GET_USER,
  variables: { id: userId },
  cacheKey: `gql:GetUser:${userId}`,
});
```

---

## Cache invalidation

`createCachePlugin` returns a `CachePlugin` object with two invalidation methods.

```ts
import { createCachePlugin } from "@tdanks2000/api-core";

const cache = createCachePlugin({ ttlMs: 60_000 });
const client = createClient({ baseUrl: "...", plugins: [cache] });

// Invalidate by exact key (auto-generated from method + URL + query)
await cache.invalidate("GET:https://api.example.com/v1/users/1");

// Invalidate by tag — removes all entries stored with that tag
await client.get("/users/1", { tags: ["user"] });
await client.get("/users/2", { tags: ["user"] });
await cache.invalidateByTag("user"); // evicts both
```

Tags are attached to requests via `RequestOptions.tags`. Only entries
cached *after* registration carry tag associations.

---

## Writing a custom plugin

```ts
import type { ApiPlugin } from "@tdanks2000/api-core";

export function createAuthPlugin(token: string): ApiPlugin {
  return {
    name: "auth",
    priority: 1, // run before logger (10) and cache (20)
    beforeRequest(ctx) {
      return {
        ...ctx,
        headers: { ...ctx.headers, authorization: `Bearer ${token}` },
      };
    },
  };
}
```

The `RequestContext` passed to `beforeRequest` includes:
- `url`, `method`, `headers`, `body`, `query` — the request shape
- `attempt` — zero-based attempt index (`0` on the first try)
- `retryCount` — retries still available after this attempt (counts down to `0`)
- `meta` — arbitrary plugin state; namespace your keys (e.g. `"auth.token"`)
- `timeoutMs`, `cacheKey`, `tags` — per-request options

To short-circuit the transport from a plugin (e.g. a custom cache), set
`ctx.syntheticResponse` to a `Response` object. The client will use it
directly and skip `transport.execute`.

---

## Swapping transport in tests

```ts
import { BaseHttpClient } from "@tdanks2000/api-core";

const client = new BaseHttpClient({
  baseUrl: "https://api.example.com",
  transport: {
    execute: async () =>
      new Response(JSON.stringify({ id: 1 }), {
        headers: { "content-type": "application/json" },
      }),
  },
});
```

---

## Custom fetch implementation

Pass a `fetch` override to use a polyfill or interceptor without building
a full `Transport`:

```ts
import nodeFetch from "node-fetch";
import { createClient } from "@tdanks2000/api-core";

const client = createClient({
  baseUrl: "https://api.example.com",
  fetch: nodeFetch as typeof globalThis.fetch,
});
```

When both `fetch` and `transport` are set, `transport` takes precedence.

---

## Custom logger

Pass `logger` to redirect internal diagnostics (e.g. plugin `onError` handler
failures) to your own logging infrastructure instead of `console`:

```ts
import { createClient } from "@tdanks2000/api-core";

const client = createClient({
  baseUrl: "https://api.example.com",
  logger: {
    info:  (msg, ...args) => structuredLogger.info(msg, ...args),
    warn:  (msg, ...args) => structuredLogger.warn(msg, ...args),
    error: (msg, ...args) => structuredLogger.error(msg, ...args),
  },
});
```

To silence all output pass `{ info: () => {}, warn: () => {}, error: () => {} }`.

---

## Cleanup

Call `client.dispose()` when the client is no longer needed. This runs each
plugin's `dispose` hook in reverse priority order, giving plugins a chance to
flush pending writes, clear timers, or close connections.

```ts
await client.dispose();
```

---

## Migrating an existing wrapper

1. Replace the wrapper's internal HTTP client with `createClient` or
   `new BaseHttpClient`.
2. Pass existing auth headers via `defaultHeaders` or a `beforeRequest`
   plugin (prefer a plugin so auth can be refreshed per-request).
3. Keep all endpoint/service class signatures unchanged — only the
   underlying HTTP call changes.
4. Add plugins through config without touching endpoint code.

---

## Versioning

Follows semantic versioning. The plugin contract (`ApiPlugin`), transport
contract (`Transport`), and context shapes (`RequestContext`,
`ResponseContext`) are stable from `1.0.0`. New hooks and optional config
fields are added as minor versions.

---

## Known limitations

The following are tracked in `improvements.md` and not yet implemented:

- **Rate-limit / metrics / tracing plugins** — planned as future milestones.
- **`ClientConfig.rateLimit`** — rate-limit policy config described in the
  plan is not yet on `ClientConfig`.
