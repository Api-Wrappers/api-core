# Adoption Guide

This guide shows how to use `@api-wrappers/api-core` inside the existing wrapper
projects without changing their public APIs.

## Adoption Rule

Replace only the internal HTTP layer. Keep exported clients, endpoint classes,
method names, parameter shapes, and response types unchanged.

## Local Dependency

From a wrapper project in this workspace:

```bash
bun add ../api-core
```

If the wrapper uses a package manager workspace later, point it at
`@api-wrappers/api-core` through the workspace protocol instead.

## Shared Internal Client Pattern

Create or update the wrapper's private HTTP client so endpoint classes keep
calling the same methods.

```ts
import {
	BaseHttpClient,
	createAuthPlugin,
	createRetryPlugin,
	createTimeoutPlugin,
	type RequestOptions,
} from "@api-wrappers/api-core";

export class HttpClient {
	private readonly core: BaseHttpClient;

	constructor(getToken: () => Promise<string>) {
		this.core = new BaseHttpClient({
			baseUrl: "https://api.example.com/v1",
			plugins: [
				createAuthPlugin(getToken),
				createRetryPlugin({ maxAttempts: 3, delayMs: 300 }),
				createTimeoutPlugin({ timeoutMs: 30_000 }),
			],
		});
	}

	get<T>(path: string, options?: RequestOptions): Promise<T> {
		return this.core.get<T>(path, options);
	}

	post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
		return this.core.post<T>(path, body, options);
	}
}
```

## IGDB Wrapper Shape

IGDB needs an async Twitch token, `Client-ID`, text bodies, retry behavior, and
request throttling.

```ts
import {
	BaseHttpClient,
	createAuthPlugin,
	createRateLimitPlugin,
	createRetryPlugin,
} from "@api-wrappers/api-core";

export class HttpClient {
	private readonly core: BaseHttpClient;

	constructor(options: { clientId: string; auth: AuthManager }) {
		this.core = new BaseHttpClient({
			baseUrl: "https://api.igdb.com/v4",
			defaultHeaders: {
				"client-id": options.clientId,
				accept: "application/json",
			},
			plugins: [
				createRateLimitPlugin({ maxConcurrent: 4, minTimeMs: 250 }),
				createAuthPlugin(() => options.auth.getAccessToken()),
				createRetryPlugin({
					maxAttempts: 3,
					delayMs: 500,
					retriableStatusCodes: [429, 500, 502, 503, 504],
				}),
			],
		});
	}

	request<T>(endpoint: string, body: string): Promise<T[]> {
		return this.core.post<T[]>(endpoint, body, {
			headers: { "content-type": "text/plain" },
		});
	}

	async requestCount(endpoint: string, body: string): Promise<number> {
		const data = await this.core.post<{ count: number }>(`${endpoint}/count`, body, {
			headers: { "content-type": "text/plain" },
		});
		return data.count;
	}
}
```

Map `ApiError`, `RateLimitError`, and `TimeoutError` to the wrapper's existing
custom errors if preserving exact error classes is required.

## TMDB Wrapper Shape

TMDB primarily needs query parameters, bearer token or API key auth, timeout,
retry, and response payload errors.

```ts
import {
	BaseHttpClient,
	createAuthPlugin,
	createRetryPlugin,
	createTimeoutPlugin,
	type QueryParams,
} from "@api-wrappers/api-core";

export class API {
	private readonly apiKey?: string;
	private readonly core: BaseHttpClient;

	constructor(auth: string | { apiKey?: string; accessToken?: string }) {
		const accessToken = typeof auth === "string" ? auth : auth.accessToken;
		this.apiKey = typeof auth === "string" ? undefined : auth.apiKey;

		this.core = new BaseHttpClient({
			baseUrl: "https://api.themoviedb.org/3",
			defaultHeaders: { accept: "application/json" },
			plugins: [
				...(accessToken ? [createAuthPlugin(accessToken)] : []),
				createRetryPlugin({
					maxAttempts: 3,
					delayMs: 300,
					retriableStatusCodes: [429, 502, 503, 504],
				}),
				createTimeoutPlugin({ timeoutMs: 30_000 }),
			],
		});
	}

	get<T>(path: string, query: QueryParams = {}): Promise<T> {
		return this.core.get<T>(path, {
			query: {
				...query,
				...(this.apiKey ? { api_key: this.apiKey } : {}),
			},
		});
	}
}
```

Array query values are supported directly:

```ts
api.get("/discover/movie", { with_genres: [28, 12], page: 2 });
```

## AniList Wrapper Shape

AniList is GraphQL-only. The generated SDK can continue to own typed operation
shapes, or services can call `core.graphql()` directly.

```ts
import {
	BaseHttpClient,
	createAuthPlugin,
	createRetryPlugin,
} from "@api-wrappers/api-core";

const core = new BaseHttpClient({
	baseUrl: "https://graphql.anilist.co",
	plugins: [
		...(token ? [createAuthPlugin(token)] : []),
		createRetryPlugin({
			maxAttempts: 4,
			delayMs: 1_000,
			retriableStatusCodes: [429, 500, 502, 503, 504],
		}),
	],
});

const data = await core.graphql<GetMediaQuery, GetMediaVariables>("/", {
	query: GET_MEDIA,
	variables: { id: 1 },
});
```

## Testing A Wrapper

Use a custom transport to keep wrapper tests deterministic:

```ts
const core = new BaseHttpClient({
	baseUrl: "https://api.example.com",
	transport: {
		execute: async (ctx) =>
			new Response(JSON.stringify(fixtures[ctx.url] ?? {}), {
				headers: { "content-type": "application/json" },
			}),
	},
});
```

This avoids network calls while still exercising wrapper endpoints, query
building, auth plugins, cache behavior, and error mapping.

## Adoption Checklist

- Install `@api-wrappers/api-core`.
- Replace only the wrapper's private HTTP implementation.
- Preserve existing public wrapper classes and endpoint method signatures.
- Move token lookup into `createAuthPlugin`.
- Move retries into `createRetryPlugin`.
- Move throttling into `createRateLimitPlugin` where needed.
- Keep wrapper-specific error classes by mapping core errors at the wrapper
  boundary if the public API already documents those classes.
- Add transport-backed tests for one success response, one API error, one auth
  request, and one retry or rate-limit path.
