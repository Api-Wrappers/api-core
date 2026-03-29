# Migration guide

This guide covers migrating existing `api-wrappers` repositories to
`@tdanks2000/api-core`.

---

## Guiding principle

**Replace the HTTP layer; keep everything else.**

Endpoint classes, service methods, and auth shapes stay identical. Only the
internal client that fires requests changes. Wrappers should not need to
update a single public method signature.

---

## Step 1 — install the package

```bash
bun add @tdanks2000/api-core
# or
npm install @tdanks2000/api-core
```

---

## Step 2 — replace the HTTP client

### Before (typical internal client)

```ts
class HttpClient {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as T;
  }
}
```

### After

```ts
import { createClient } from "@tdanks2000/api-core";

class HttpClient {
  private readonly client;

  constructor(baseUrl: string, token: string) {
    this.client = createClient({
      baseUrl,
      defaultHeaders: { authorization: `Bearer ${token}` },
    });
  }

  get<T>(path: string): Promise<T> {
    return this.client.get<T>(path);
  }
}
```

The public interface of `HttpClient` is unchanged. Endpoint classes that
call `this.httpClient.get(...)` need no changes.

---

## Step 3 — migrate auth

If auth tokens are refreshed dynamically, move that logic into a plugin
rather than rebuilding the header on every call site:

```ts
import { createClient, type ApiPlugin } from "@tdanks2000/api-core";

function createAuthPlugin(authManager: AuthManager): ApiPlugin {
  return {
    name: "auth",
    priority: 2,
    async beforeRequest(ctx) {
      const token = await authManager.getValidToken(); // refreshes if expired
      return { ...ctx, headers: { ...ctx.headers, authorization: `Bearer ${token}` } };
    },
  };
}

const client = createClient({
  baseUrl: "https://api.example.com",
  plugins: [createAuthPlugin(authManager)],
});
```

---

## Step 4 — adopt error types (optional)

The core exports `ApiError`, `RateLimitError`, and `TimeoutError`.
Existing wrappers that catch `Error` and check `.message` or `.status`
can migrate `instanceof` checks incrementally:

```ts
import { ApiError, RateLimitError } from "@tdanks2000/api-core";

try {
  await client.get("/resource");
} catch (err) {
  if (err instanceof RateLimitError) {
    // retryAfterMs available
  } else if (err instanceof ApiError) {
    // status + responseBody available
  }
}
```

This is additive — no existing error-handling code breaks.

---

## Step 5 — add plugins gradually

Plugins can be added to any client without changing endpoint code:

```ts
import {
  createClient,
  createLoggerPlugin,
  createCachePlugin,
  createRetryPlugin,
} from "@tdanks2000/api-core";

const client = createClient({
  baseUrl: "https://api.example.com",
  plugins: [
    createLoggerPlugin(),
    createCachePlugin({ ttlMs: 30_000 }),
    createRetryPlugin({ maxAttempts: 3, delayMs: 200 }),
  ],
});
```

---

## Step 6 — swap the transport in tests

Replace real network calls with a deterministic mock:

```ts
import { BaseHttpClient } from "@tdanks2000/api-core";

const client = new BaseHttpClient({
  baseUrl: "https://api.example.com",
  transport: {
    execute: async (ctx) =>
      new Response(JSON.stringify(fixtures[ctx.url] ?? {}), {
        headers: { "content-type": "application/json" },
      }),
  },
});
```

---

## Wrapper-specific notes

### IGDB wrapper

1. Keep `AuthManager` as-is.
2. Replace `HttpClient` internals with `createClient`.
3. Pass the bearer token via `defaultHeaders` or an auth plugin.
4. Keep all `*Endpoint` class signatures unchanged.

### TMDB wrapper

1. Keep the constructor shape (`new TMDBClient(apiKey)`).
2. Construct the core client inside the constructor:
   `this._core = createClient({ baseUrl, defaultHeaders: { Authorization: ... } })`.
3. Proxy all endpoint calls through `this._core.get/post`.

### AniList wrapper

AniList is GraphQL-only. Use `client.graphql()` directly:

```ts
import { createClient } from "@tdanks2000/api-core";

const client = createClient({ baseUrl: "https://graphql.anilist.co" });

const data = await client.graphql<AniListQuery>("/", {
  query: ANILIST_QUERY,
  variables: { id: 1 },
});
```

Existing service classes forward calls to `client.graphql()` without
exposing the HTTP mechanics to callers.

---

## Backward compatibility rules

- Default behaviour (no plugins) is identical to a plain `fetch` call.
- `content-type: application/json` is always set; if your wrapper already
  set it manually, the duplicate is safely overwritten (headers are
  case-insensitively merged, last writer wins).
- Existing response body shapes are unchanged — the core parses JSON when
  `content-type: application/json` is present and returns text otherwise.
- No existing public method on any wrapper endpoint class needs to change.
