# Documentation

`@api-wrappers/api-core` is a shared HTTP runtime for TypeScript API wrapper
packages. These docs explain how to install the package, create clients, send
REST and GraphQL requests, add plugins, handle errors, and test wrappers without
network calls.

## Start Here

- [Getting Started](getting-started.md): install the package and make your first
  REST request.
- [Examples](examples.md): copy-pasteable REST, plugin, GraphQL, transport, and
  error-handling examples.
- [REST Requests](guides/rest-requests.md): request methods, query strings,
  headers, bodies, abort signals, and response metadata.
- [GraphQL](guides/graphql.md): typed GraphQL queries and GraphQL error
  handling.

## Guides

- [Plugins](guides/plugins.md): how the plugin lifecycle works and how to write
  custom plugins.
- [Built-In Plugins](guides/built-in-plugins.md): auth, retry, timeout,
  rate-limit, cache, and logger plugins.
- [Error Handling](guides/error-handling.md): `ApiError`, `RateLimitError`,
  `TimeoutError`, and `GraphQLRequestError`.
- [Testing](guides/testing.md): custom transports and deterministic test
  clients.

## Reference

- [Client API](reference/client.md): `BaseHttpClient`, `createClient`,
  `request`, `requestWithResponse`, and convenience methods.
- [Configuration](reference/configuration.md): `ClientConfig`, `RequestOptions`,
  retry config, query params, and transport config.
- [Exports](reference/exports.md): complete public export list.

## Project

- [Roadmap](../ROADMAP.md): direction, priorities, and non-goals for the shared
  runtime.
- [Contributing](../CONTRIBUTING.md): setup, validation, review expectations,
  and TypeScript guidelines.
- [Contributing Ideas](contributing-ideas.md): starter issues and larger
  follow-up ideas.

## Recommended Reading Order

1. [Getting Started](getting-started.md)
2. [Examples](examples.md)
3. [REST Requests](guides/rest-requests.md)
4. [Built-In Plugins](guides/built-in-plugins.md)
5. [Error Handling](guides/error-handling.md)
6. [Testing](guides/testing.md)
