# REST Requests

The client exposes convenience methods for common HTTP verbs and a generic
`request` method for custom cases.

## Methods

```ts
client.get<T>(path, options);
client.post<T>(path, body, options);
client.put<T>(path, body, options);
client.patch<T>(path, body, options);
client.delete<T>(path, options);
client.head<T>(path, options);
client.options<T>(path, options);
client.request<T>(path, { method: "POST", body });
```

`path` may start with `/` or omit it. Both are joined safely with `baseUrl`.
Absolute URLs are also supported.

## Request Options

```ts
await client.get("/movies", {
	query: {
		page: 1,
		language: "en-US",
		with_genres: [28, 12],
		ignored: undefined,
	},
	headers: {
		accept: "application/json",
	},
	timeoutMs: 10_000,
	signal: abortController.signal,
	cacheKey: "movies:page:1",
	tags: ["movies"],
});
```

| Option | Description |
| --- | --- |
| `method` | HTTP method for `request`. Convenience methods set this for you. |
| `headers` | Per-request headers. These override `defaultHeaders`. |
| `body` | Request body. Objects/arrays are JSON encoded; strings are sent as-is. |
| `query` | Query string values. Arrays become repeated query parameters. |
| `timeoutMs` | Per-request timeout override. |
| `signal` | Caller-provided abort signal. Composes with timeout handling. |
| `cacheKey` | Explicit key for cache plugins. |
| `tags` | Labels plugins can use for cache invalidation or metrics. |
| `responseType` | Override response parsing with `json`, `text`, `arrayBuffer`, or `blob`. Defaults to `auto`. |
| `errorResponseType` | Override non-2xx body parsing. Defaults to `auto`. |

`headers` and `defaultHeaders` accept any `HeadersInit` shape: plain objects,
native `Headers`, or `[name, value]` tuples. Header names are normalized
case-insensitively before the request reaches plugins or transports.

## Response Metadata

Use `requestWithResponse` when the wrapper needs headers, status, request data,
or plugin metadata.

```ts
const result = await client.requestWithResponse<MoviePage>("/movie/popular");

result.data;
result.response.status;
result.response.headers.get("x-ratelimit-remaining");
result.request.url;
result.meta["cache.served"];
```

`requestWithResponse` has the same retry, timeout, parsing, plugin, and error
behavior as `request`.

## Text Body APIs

Some APIs expect a custom text query language rather than JSON. Pass a string
body and override `content-type`.

```ts
const games = await client.post<Game[]>(
	"/games",
	"fields name,rating; sort rating desc; limit 10;",
	{
		headers: {
			"content-type": "text/plain",
			accept: "application/json",
		},
	},
);
```

## Binary Responses

Use `responseType: "arrayBuffer"` for endpoints that return binary payloads
while still going through retries, plugins, timeouts, and the configured
transport.

```ts
const bytes = await client.post<ArrayBuffer>("/games.pb", "fields id;", {
	headers: { accept: "application/octet-stream" },
	responseType: "arrayBuffer",
});
```

## Custom Fetch Or Transport

Use `fetch` when you only need to swap the fetch implementation:

```ts
const client = createClient({
	baseUrl: "https://api.example.com",
	fetch: customFetch,
});
```

Use `transport` when you want full control over execution:

```ts
const client = createClient({
	baseUrl: "https://api.example.com",
	transport: {
		execute: async (ctx) => {
			return new Response(JSON.stringify({ url: ctx.url }), {
				headers: { "content-type": "application/json" },
			});
		},
	},
});
```
