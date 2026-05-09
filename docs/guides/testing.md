# Testing

Use a custom transport to test wrapper behavior without network calls.

## Basic Mock Transport

```ts
import { BaseHttpClient } from "@api-wrappers/api-core";

const client = new BaseHttpClient({
	baseUrl: "https://api.example.com",
	transport: {
		execute: async (ctx) =>
			new Response(JSON.stringify({ url: ctx.url, method: ctx.method }), {
				headers: { "content-type": "application/json" },
			}),
	},
});
```

## Assert Request Shape

```ts
let capturedUrl: string | undefined;
let capturedHeaders: Record<string, string> | undefined;

const client = new BaseHttpClient({
	baseUrl: "https://api.example.com",
	defaultHeaders: { accept: "application/json" },
	transport: {
		execute: async (ctx) => {
			capturedUrl = ctx.url;
			capturedHeaders = ctx.headers;
			return new Response(JSON.stringify({ ok: true }), {
				headers: { "content-type": "application/json" },
			});
		},
	},
});

await client.get("/users/1");
```

## Test Errors

```ts
const client = new BaseHttpClient({
	baseUrl: "https://api.example.com",
	transport: {
		execute: async () =>
			new Response(JSON.stringify({ message: "not found" }), {
				status: 404,
				headers: { "content-type": "application/json" },
			}),
	},
});

await expect(client.get("/missing")).rejects.toThrow();
```

## Test Plugins

Register the same plugins your wrapper uses in production. The transport stays
mocked, but auth, cache, retry, timeout, and custom plugin behavior still runs.

```ts
const cache = createCachePlugin({ ttlMs: 60_000 });

const client = new BaseHttpClient({
	baseUrl: "https://api.example.com",
	plugins: [createAuthPlugin("token"), cache],
	transport: {
		execute: async () =>
			new Response(JSON.stringify({ ok: true }), {
				headers: { "content-type": "application/json" },
			}),
	},
});
```

## Smoke Test A Built Package

After `bun run build`, verify both module formats:

```bash
node --input-type=module -e "const m = await import('./dist/index.mjs'); if (!m.createClient) throw new Error('missing ESM export')"
node -e "const m = require('./dist/index.cjs'); if (!m.createClient) throw new Error('missing CJS export')"
```
