# Changelog

## 1.1.0

### Minor Changes

- 787f222: Add conditional retry-plugin predicates for per-request safe and unsafe operation policies.
- 8e5afc2: Add a GraphQL response helper that preserves raw response headers, request context, plugin metadata, and GraphQL extensions.
- 0759252: Add a first-class GraphQL requester bridge for generated SDKs.
- 1387988: Add a stable `@api-wrappers/api-core/graphql` package subpath for GraphQL-focused imports.
- 7750c07: Allow GraphQL errors and response envelopes to carry strongly typed provider-specific fields.
- e6bbd8d: Add an adaptive rate-limit plugin driven by standard and provider-specific response headers.

### Patch Changes

- 6228ac9: Reject conflicting GraphQL fragment definitions instead of silently keeping the first definition.

## 1.0.3 - 2026-06-25

- Rate limiter now observes `AbortSignal`: an in-flight delay is cancelled immediately when the signal fires.
- Logger plugin now supports `logBody` and `redactBody` options to include or selectively redact request/response bodies in log output.
- Improved package discovery metadata (keywords, description).

## 1.0.2 - 2026-05-14

- Broadened the TypeScript peer dependency range to support TypeScript 6.
- Added clearer README guidance for developers building wrapper libraries.

## 1.0.1 - 2026-05-14

- Fixed cache keys so array and nullish query params match the actual transport URL serialization.
- Fixed `afterResponse` status handling so plugins can replace the final response.
- Fixed GraphQL requests so callers cannot accidentally override the JSON content type.
- Added structured JSON content-type support for `application/*+json` responses and request bodies.
- Added retry attempt normalization and accurate `retryCount` values when retry plugins override `maxAttempts`.
- Added native `HeadersInit` support for default, per-request, and GraphQL headers.
- Added error guard helpers for ergonomic TypeScript error handling.
- Added a one-command `verify` script, package metadata cleanup, package export for `package.json`, and an MIT license file.
