# Roadmap

`@api-wrappers/api-core` is the shared runtime layer for the Api-Wrappers
ecosystem. The roadmap focuses on keeping that foundation stable, observable,
and easy for wrapper packages to adopt without duplicating HTTP plumbing.

## Current priorities

- Keep the public runtime API small and stable.
- Preserve strict TypeScript support for wrappers and application consumers.
- Maintain Bun, Node, browser, and edge runtime compatibility.
- Improve examples for common wrapper needs: auth, retries, timeouts, caching,
  rate limits, GraphQL, and custom transports.
- Keep tests deterministic by making network execution replaceable.

## Near term

- Expand docs around plugin ordering, error handling, and transport behavior.
- Add more copy-pasteable wrapper author recipes.
- Improve contributor onboarding with starter issues and clearer review
  expectations.
- Keep package metadata, exports, and generated declarations easy to audit.

## Later

- Add more transport examples for observability and request tracing.
- Document recommended patterns for generated endpoint packages.
- Evaluate additional plugin primitives only when multiple wrapper packages need
  the same behavior.
- Track compatibility notes for major runtime changes in Bun, Node, and
  TypeScript.

## Non-goals

- Becoming a full application data-fetching framework.
- Generating API endpoint clients from schemas.
- Owning provider-specific endpoint models.
- Hiding HTTP behavior behind implicit global state.

## How roadmap decisions are made

Changes should make wrapper packages easier to maintain, safer to test, or more
consistent for users. New public API should have a clear wrapper use case, typed
examples, tests, and a migration story when it changes existing behavior.
