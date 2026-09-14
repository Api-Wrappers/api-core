---
"@api-wrappers/api-core": patch
---

Fix request-lifecycle edge cases and share GraphQL envelope handling:

- `buildUrl` now inserts query parameters before a URL fragment instead of after it.
- Multipart, URL-encoded, and binary request bodies no longer receive a default `content-type: application/json`, so `fetch` can set the correct value (including the multipart boundary).
- GraphQL envelope validation is shared by `client.graphql()` and `graphqlWithResponse()`; a non-array `errors` field now throws `ApiError` instead of silently succeeding, while `errors: null` is treated as a successful response.
- `graphqlWithResponse()` reports GraphQL application errors and malformed envelopes to plugin `onError` hooks via the new `BaseHttpClient.notifyError()`, matching `client.graphql()`.
- `Retry-After` parsing is centralized so the retry loop and the header rate-limit plugin agree on delay-seconds and HTTP-date formats.
- Caller aborts are no longer retried; retry backoff waits are cancellable.
- A per-request `timeoutMs` takes precedence over the timeout plugin and `ClientConfig.timeoutMs`; `createTimeoutPlugin` rejects non-positive timeouts.
- Response parse failures now notify plugins through `onError`.
- Cache keys vary on the request body and cacheable-method matching is case-insensitive.
- `ApiError` (and subclasses) expose response `headers` and final `url` details.
- `mergeHeaders` skips `null`/`undefined` values instead of stringifying them.
