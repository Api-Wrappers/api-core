# Plugin authoring guide

Plugins are the primary extension point of `@tdanks2000/api-core`. Every
built-in behaviour — caching, retrying, logging, timeouts — is a plugin.
This guide explains how to write one.

---

## The `ApiPlugin` interface

```ts
import type { ApiPlugin } from "@tdanks2000/api-core";

const myPlugin: ApiPlugin = {
  name: "my-plugin",   // required; used in error messages
  priority: 50,        // optional; controls ordering (default 100)
  enabled: true,       // optional; false = skip entirely

  setup(client) { /* ... */ },
  beforeRequest(ctx)  { return ctx; },
  afterResponse(ctx)  { return ctx; },
  onError(err, ctx)   { /* ... */ },
  dispose()           { /* ... */ },
};
```

All hooks are optional. Implement only what you need.

---

## Hook execution order

```
setup          once, when the client first makes a request
  │
  ▼
beforeRequest  ascending priority (lower number runs first)
  │            each plugin receives the ctx returned by the previous one
  ▼
[transport]    skipped when ctx.syntheticResponse is set (e.g. cache hit)
  │
  ▼
afterResponse  descending priority (higher number runs first)
  │
  ▼
onError        all plugins, on any failure; individual throws are caught+logged
```

The `beforeRequest` → `afterResponse` reversal is intentional: the plugin
that wraps the request first should also unwrap the response last (LIFO).

---

## Priority reference

| Range | Conventional use |
|-------|-----------------|
| 1–9 | Auth headers, timeout stamping |
| 10–19 | Logging, tracing |
| 20–49 | Caching |
| 50–99 | Custom middleware |
| 100+ | Post-processing, response normalisation |

Built-in defaults: `timeout=1`, `logger=10`, `cache=20`, `retry=5`.

---

## `beforeRequest` — mutating the request

Return a new context object (spread + override). Never mutate `ctx` in place.

```ts
beforeRequest(ctx) {
  return {
    ...ctx,
    headers: { ...ctx.headers, authorization: `Bearer ${token}` },
  };
}
```

### Skipping the transport (synthetic response)

Set `ctx.syntheticResponse` to a `Response` and the transport call is
skipped for that request. The rest of the pipeline (afterResponse, status
checks) still runs normally.

```ts
beforeRequest(ctx) {
  const cached = myCache.get(ctx.url);
  if (cached) {
    ctx.syntheticResponse = new Response(JSON.stringify(cached), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return ctx;
}
```

### Using `ctx.meta` for plugin-to-plugin state

`ctx.meta` is a plain `Record<string, unknown>`. Namespace your keys to
avoid collisions:

```ts
beforeRequest(ctx) {
  ctx.meta["my-plugin.startedAt"] = Date.now();
  return ctx;
}
```

### Available context fields

| Field | Type | Notes |
|-------|------|-------|
| `url` | `string` | Full URL including baseUrl |
| `method` | `HttpMethod` | `"GET"`, `"POST"`, etc. |
| `headers` | `Record<string,string>` | All headers, lowercased |
| `body` | `unknown` | Serialised to JSON by fetchTransport |
| `query` | `Record<string, ...>` | Appended to URL as query string |
| `attempt` | `number` | Zero-based attempt index |
| `retryCount` | `number` | Retries remaining after this attempt |
| `timeoutMs` | `number \| undefined` | Abort threshold |
| `cacheKey` | `string \| undefined` | Explicit cache key |
| `tags` | `string[]` | Arbitrary grouping labels |
| `meta` | `Record<string,unknown>` | Plugin-to-plugin state |
| `syntheticResponse` | `Response \| undefined` | Set to skip transport |

---

## `afterResponse` — mutating the response

Return a new `ResponseContext`. The final `parsedBody` is what `client.get()`
etc. return to the caller.

```ts
afterResponse(ctx) {
  const duration = Date.now() - (ctx.request.meta["my-plugin.startedAt"] as number);
  ctx.meta["my-plugin.durationMs"] = duration;
  return ctx;
}
```

### `ResponseContext` fields

| Field | Type | Notes |
|-------|------|-------|
| `request` | `RequestContext` | The request that produced this response |
| `response` | `Response` | Raw fetch `Response` |
| `parsedBody` | `unknown` | JSON-parsed or text; plugins may replace this |
| `meta` | `Record<string,unknown>` | Response-scoped plugin state |

---

## `onError` — observing failures

Called whenever the pipeline throws (transport error, non-2xx after retries,
`beforeRequest` or `afterResponse` plugin throwing).

```ts
onError(error, ctx) {
  metrics.increment("api.error", { method: ctx.method, url: ctx.url });
}
```

An exception thrown from `onError` is **caught and logged** by
`PluginManager`; it does not propagate. Do not rely on re-throwing here.

---

## `setup` and `dispose`

`setup` is called once, lazily, before the first request. Use it for
async initialisation (loading config, opening connections).

`dispose` runs in reverse priority order when `client.dispose()` is called.
Use it to flush buffers, clear timers, or close connections.

```ts
{
  name: "metrics",
  async setup(client) {
    await metricsClient.connect();
  },
  async dispose() {
    await metricsClient.flush();
    await metricsClient.disconnect();
  },
}
```

---

## Complete example — auth plugin with token refresh

```ts
import type { ApiPlugin } from "@tdanks2000/api-core";

export function createAuthPlugin(getToken: () => Promise<string>): ApiPlugin {
  return {
    name: "auth",
    priority: 2, // before logger so logged headers include auth

    async beforeRequest(ctx) {
      const token = await getToken(); // called fresh on every request
      return {
        ...ctx,
        headers: { ...ctx.headers, authorization: `Bearer ${token}` },
      };
    },

    onError(error, ctx) {
      if ((error as { status?: number }).status === 401) {
        // Optionally signal token refresh here
      }
    },
  };
}
```

---

## Extending `createCachePlugin` with a custom store

Implement `CacheStore` to back the cache with Redis, KV, or any other store:

```ts
import type { CacheStore } from "@tdanks2000/api-core";

class RedisStore implements CacheStore {
  async get(key: string) { return redis.get(key); }
  async set(key: string, value: unknown, ttlMs?: number) {
    const px = ttlMs ?? 0;
    await redis.set(key, JSON.stringify(value), px ? { px } : undefined);
  }
  async delete(key: string) { await redis.del(key); }
  async clear() { await redis.flushdb(); }
}

const cache = createCachePlugin({ store: new RedisStore(), ttlMs: 30_000 });
```

---

## Tips

- **Always spread `ctx`** — `return { ...ctx, headers: { ...ctx.headers, foo: "bar" } }`.
  Mutating `ctx` directly may work today but breaks if the pipeline ever
  passes the same object to multiple hooks.
- **Namespace `meta` keys** — use `"my-plugin.key"` not `"key"`.
- **Keep hooks synchronous when possible** — `async` hooks add a microtask
  overhead per-request; use `async` only when you need it.
- **Test with a mock transport** — see `src/__tests__/` for examples.
