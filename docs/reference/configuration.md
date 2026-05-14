# Configuration Reference

## `ClientConfig`

```ts
interface ClientConfig {
	baseUrl: string;
	defaultHeaders?: HeaderInput;
	plugins?: ApiPlugin[];
	transport?: Transport;
	fetch?: FetchLike;
	timeoutMs?: number;
	retry?: RetryConfig;
	logger?: LoggerInterface;
}
```

| Field | Description |
| --- | --- |
| `baseUrl` | Base URL prepended to relative request paths. |
| `defaultHeaders` | Headers merged into every request. |
| `plugins` | Plugins registered for the client lifetime. |
| `transport` | Custom request executor. Takes precedence over `fetch`. |
| `fetch` | Custom fetch implementation used by the default transport. |
| `timeoutMs` | Default timeout for every request. |
| `retry` | Global retry policy. |
| `logger` | Logger used for internal diagnostics. |

## `RequestOptions`

```ts
interface RequestOptions {
	method?: HttpMethod;
	headers?: HeaderInput;
	body?: unknown;
	query?: QueryParams;
	signal?: AbortSignal;
	timeoutMs?: number;
	cacheKey?: string;
	tags?: string[];
}
```

## `GraphQLRequestOptions<TVariables>`

```ts
interface GraphQLRequestOptions<TVariables extends object = Record<string, unknown>> {
	query: string;
	variables?: TVariables;
	operationName?: string;
	headers?: HeaderInput;
	signal?: AbortSignal;
	timeoutMs?: number;
	cacheKey?: string;
	tags?: string[];
}
```

## `RetryConfig`

```ts
interface RetryConfig {
	maxAttempts: number;
	delayMs?: number;
	jitter?: boolean;
	retriableStatusCodes?: number[];
}
```

`maxAttempts` includes the first attempt. A value of `1` means no retry.

## Query Types

```ts
type HeaderInput = HeadersInit;

type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

type QueryPrimitive = string | number | boolean;

type QueryValue =
	| QueryPrimitive
	| null
	| undefined
	| readonly (QueryPrimitive | null | undefined)[];

type QueryParams = Record<string, QueryValue>;
```

Nullish query values are skipped. Array query values are emitted as repeated
query parameters.

Headers accept the same shapes as `fetch`: a plain object, a `Headers`
instance, or `[name, value]` tuples. Header names are normalized to lowercase
internally and later sources override earlier sources case-insensitively.

## `Transport`

```ts
interface Transport {
	execute(ctx: RequestContext): Promise<Response>;
}
```

Custom transports are useful for tests, tracing, custom networking layers, or
non-fetch runtimes.
