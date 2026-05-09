# Error Handling

The client throws typed errors for HTTP failures, rate limits, timeouts, and
GraphQL application errors.

## Error Types

| Error | When it is thrown | Useful fields |
| --- | --- | --- |
| `ApiError` | Non-2xx HTTP response after retries are exhausted | `status`, `responseBody`, `cause` |
| `RateLimitError` | HTTP 429 response | `retryAfterMs`, `responseBody` |
| `TimeoutError` | Request timeout | `cause` |
| `GraphQLRequestError` | GraphQL response contains `errors` | `graphqlErrors`, `partialData` |

## Handling Errors

```ts
import {
	ApiError,
	GraphQLRequestError,
	RateLimitError,
	TimeoutError,
} from "@api-wrappers/api-core";

try {
	await client.get("/resource");
} catch (error) {
	if (error instanceof RateLimitError) {
		console.log("retry after", error.retryAfterMs);
	} else if (error instanceof TimeoutError) {
		console.log("request timed out");
	} else if (error instanceof GraphQLRequestError) {
		console.log(error.graphqlErrors);
	} else if (error instanceof ApiError) {
		console.log(error.status, error.responseBody);
	}
}
```

## HTTP Errors

For non-2xx responses, the client parses the response body first and stores it
on `error.responseBody`.

```ts
try {
	await client.get("/missing");
} catch (error) {
	if (error instanceof ApiError) {
		console.log(error.status);
		console.log(error.responseBody);
	}
}
```

## Rate Limits

`RateLimitError.retryAfterMs` is set when the server provides `retry-after`.

```ts
if (error instanceof RateLimitError && error.retryAfterMs) {
	await sleep(error.retryAfterMs);
}
```

## Plugin Errors

When `beforeRequest` or `afterResponse` throws, the error is wrapped as a
`PluginError` with the plugin name in the message. `onError` handlers still run.

Errors thrown inside `onError` handlers are logged through the configured logger
and do not stop other `onError` handlers.
