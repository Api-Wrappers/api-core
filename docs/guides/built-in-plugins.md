# Built-In Plugins

The package includes plugins for the behavior most wrappers need by default.

## Auth

Adds an auth header before each request.

```ts
createAuthPlugin("static-token");
createAuthPlugin(() => authManager.getAccessToken());
createAuthPlugin({
	getToken: () => apiKey,
	headerName: "x-api-key",
	scheme: null,
});
```

Default output:

```txt
authorization: Bearer <token>
```

## Retry

Overrides retry settings per request by writing retry metadata into the request
context.

```ts
createRetryPlugin({
	maxAttempts: 3,
	delayMs: 300,
	jitter: true,
	retriableStatusCodes: [429, 500, 502, 503, 504],
});
```

`429` responses respect `retry-after`. Numeric header values are treated as
seconds, and HTTP-date values are supported.

## Timeout

Sets `timeoutMs` on each request context.

```ts
createTimeoutPlugin({ timeoutMs: 30_000 });
```

Timeouts are enforced by the default fetch transport and throw `TimeoutError`.

## Rate Limit

Controls request start timing before transport execution.

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

Slots are released on successful responses, HTTP errors, transport errors, and
plugin errors.

## Cache

Caches successful responses for configured methods.

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
```

Invalidate a specific key:

```ts
await cache.invalidate("GET:https://api.example.com/users/1");
```

Invalidate by tag:

```ts
await client.get("/users/1", { tags: ["user"] });
await client.get("/users/2", { tags: ["user"] });
await cache.invalidateByTag("user");
```

## Logger

Logs request starts, responses, and errors. Request bodies are omitted by
default so tokens, secrets, search payloads, and user data do not reach logs
accidentally.

```ts
createLoggerPlugin({
	logRequest: true,
	logResponse: true,
	logError: true,
	logBody: false,
	logger: console,
});
```

Opt in to body logging only when the output is safe, and redact before logging:

```ts
createLoggerPlugin({
	logBody: true,
	redactBody: () => ({ token: "[redacted]" }),
});
```

Pass a structured logger or no-op logger to control output.
