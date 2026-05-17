# Client API

## `createClient(config)`

Creates a `BaseHttpClient`.

```ts
const client = createClient({
	baseUrl: "https://api.example.com",
});
```

## `BaseHttpClient`

Use `BaseHttpClient` directly when building wrapper-specific classes.

```ts
class MyApiClient extends BaseHttpClient {
	getUser(id: string) {
		return this.get<User>(`/users/${id}`);
	}
}
```

## Methods

| Method | Description |
| --- | --- |
| `request<T>(path, options)` | Execute a request and return the parsed body. |
| `requestWithResponse<T>(path, options)` | Execute a request and return body, response, request context, and metadata. |
| `get<T>(path, options)` | GET request. |
| `post<T>(path, body, options)` | POST request. |
| `put<T>(path, body, options)` | PUT request. |
| `patch<T>(path, body, options)` | PATCH request. |
| `delete<T>(path, options)` | DELETE request. |
| `head<T>(path, options)` | HEAD request. |
| `options<T>(path, options)` | OPTIONS request. |
| `graphql<TData, TVariables>(path, options)` | GraphQL POST request returning `data`. |
| `init()` | Initialize plugins. Called lazily before the first request. |
| `dispose()` | Run plugin cleanup hooks. |

## Response Parsing

Requests parse JSON automatically when the response content type is JSON and
fall back to text for other bodies. Pass `responseType` to override that:

```ts
await client.get<string>("/robots.txt", { responseType: "text" });
await client.post<ArrayBuffer>("/games.pb", query, {
	responseType: "arrayBuffer",
});
```

## `requestWithResponse<T>(path, options)`

Use `requestWithResponse` when you need more than just parsed data. Prefer
`request` for normal API calls, and choose `requestWithResponse` for wrappers,
instrumentation, caching decisions, or debugging where headers/status/request
context matter.

```ts
const result = await client.requestWithResponse<MoviePage>("/movie/popular");

result.data; // Parsed response body
result.response.status; // Raw status code
result.response.headers.get("x-ratelimit-remaining"); // Header access
result.request.url; // Final URL after query merge
result.meta["cache.served"]; // Plugin-provided metadata
```

## `ApiResponse<T>`

Returned by `requestWithResponse`.

```ts
interface ApiResponse<T = unknown> {
	data: T; // Parsed body returned by the parser
	response: Response; // Native response object for headers/status
	request: RequestContext; // Request details (URL, method, headers)
	meta: Record<string, unknown>; // Plugin metadata from the request pipeline
}
```
