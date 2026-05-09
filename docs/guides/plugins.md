# Plugins

Plugins let wrappers add behavior around every request without duplicating HTTP
plumbing in endpoint classes.

## Lifecycle

| Hook | When it runs | Order |
| --- | --- | --- |
| `setup(client)` | Once before the first request | Lower priority first |
| `beforeRequest(ctx)` | Before transport execution | Lower priority first |
| `afterResponse(ctx)` | After response parsing | Higher priority first |
| `onError(error, ctx)` | When the request pipeline throws | Registered order |
| `dispose()` | When `client.dispose()` is called | Higher priority first |

Returning `undefined` keeps the current context. Return a new object to mutate
request or response state.

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

Use `meta` for plugin state and namespace keys, for example
`"metrics.startedAt"` or `"auth.token"`.

## Response Context

```ts
interface ResponseContext {
	request: RequestContext;
	response: Response;
	parsedBody?: unknown;
	meta: Record<string, unknown>;
}
```

## Example Plugin

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

## Measuring Duration

```ts
export function createTimingPlugin(): ApiPlugin {
	return {
		name: "timing",
		priority: 10,
		beforeRequest(ctx) {
			return {
				...ctx,
				meta: { ...ctx.meta, "timing.startedAt": Date.now() },
			};
		},
		afterResponse(ctx) {
			const startedAt = ctx.request.meta["timing.startedAt"] as number;
			return {
				...ctx,
				meta: {
					...ctx.meta,
					"timing.durationMs": Date.now() - startedAt,
				},
			};
		},
	};
}
```

## Short-Circuiting The Network

Set `syntheticResponse` in `beforeRequest` to skip the transport. This is how
cache-style plugins return stored responses.

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

`afterResponse` still runs, so downstream plugins see a normal response shape.
