# Changelog

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
