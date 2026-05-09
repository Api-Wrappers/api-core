# Plugin Guide

Plugins are the extension point for wrapper-specific behavior. They can mutate
requests, observe or transform responses, short-circuit network calls, and clean
up resources when a client is disposed.

## Interface

```ts
import type { ApiPlugin } from "@api-wrappers/api-core";

const plugin: ApiPlugin = {
	name: "example",
	priority: 50,
	enabled: true,

	setup(client) {},
	beforeRequest(ctx) {
		return ctx;
	},
	afterResponse(ctx) {
		return ctx;
	},
	onError(error, ctx) {},
	dispose() {},
};
```

Every hook is optional.

## Hook Order

| Hook | When it runs | Order |
| --- | --- | --- |
| `setup` | Once, lazily before the first request | Lower priority first |
| `beforeRequest` | Before transport | Lower priority first |
| `afterResponse` | After body parsing | Higher priority first |
| `onError` | When the pipeline throws | Registered plugin order |
| `dispose` | When `client.dispose()` is called | Higher priority first |

When a hook returns `undefined`, the current context is kept. Return a new
context object to mutate state.

## Request Context

```ts
interface RequestContext {
	url: string;
	method: HttpMethod;
	headers: Record<string, string>;
	body?: unknown;
	query?: QueryParams;
	signal?: AbortSignal;
	meta: Record<string, unknown>;
	cacheKey?: string;
	tags?: string[];
	retryCount: number;
	attempt: number;
	timeoutMs?: number;
	syntheticResponse?: Response;
}
```

Use `meta` for plugin-to-plugin state. Namespace keys, for example
`"auth.token"` or `"metrics.startedAt"`.

## Response Context

```ts
interface ResponseContext {
	request: RequestContext;
	response: Response;
	parsedBody?: unknown;
	meta: Record<string, unknown>;
}
```

The final `parsedBody` is returned from `request()` and convenience methods.

## Auth Plugin

```ts
createAuthPlugin(() => authManager.getAccessToken());
createAuthPlugin("static-token");
createAuthPlugin({
	getToken: () => apiKey,
	headerName: "x-api-key",
	scheme: null,
});
```

Default output is:

```txt
authorization: Bearer <token>
```

## Retry Plugin

```ts
createRetryPlugin({
	maxAttempts: 3,
	delayMs: 300,
	jitter: true,
	retriableStatusCodes: [429, 500, 502, 503, 504],
});
```

`retry-after` is respected for `429` responses. Numeric values are treated as
seconds. HTTP-date values are also supported.

## Rate Limit Plugin

```ts
createRateLimitPlugin({
	maxConcurrent: 4,
	minTimeMs: 250,
});

createRateLimitPlugin({
	maxRequestsPerInterval: 30,
	intervalMs: 60_000,
});
```

The plugin acquires a slot in `beforeRequest` and releases it after a response
or error, including transport failures.

## Cache Plugin

```ts
const cache = createCachePlugin({
	ttlMs: 60_000,
	methods: ["GET"],
});

await cache.invalidate("GET:https://api.example.com/users/1");
await cache.invalidateByTag("user");
```

Cache hits set `ctx.meta["cache.served"]` on the response context and skip the
transport by setting `syntheticResponse`.

## Custom Plugin Example

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

## Short-Circuiting Transport

Set `ctx.syntheticResponse` in `beforeRequest` to skip the network call while
still running `afterResponse` and status handling.

```ts
beforeRequest(ctx) {
	const cached = cache.get(ctx.url);
	if (!cached) return ctx;

	return {
		...ctx,
		syntheticResponse: new Response(JSON.stringify(cached), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
	};
}
```

## Error Handling

Plugins should observe errors in `onError`; they should not rely on throwing
from `onError`. If an `onError` hook throws, the plugin manager logs it and
continues calling the remaining handlers.

```ts
onError(error, ctx) {
	metrics.increment("api.error", {
		method: ctx.method,
		url: ctx.url,
	});
}
```
