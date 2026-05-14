# Exports

## Client

- `createClient`
- `BaseHttpClient`
- `RequestOptions`
- `ApiResponse`
- `ClientConfig`
- `LoggerInterface`
- `RetryConfig`

## Context

- `RequestContext`
- `ResponseContext`

## Errors

- `ApiError`
- `RateLimitError`
- `TimeoutError`
- `GraphQLRequestError`
- `ApiCoreError`
- `isApiCoreError`
- `isApiError`
- `isGraphQLRequestError`
- `isRateLimitError`
- `isTimeoutError`

## Plugin System

- `ApiPlugin`
- `PluginManager`

## Built-In Plugins

- `createAuthPlugin`
- `AuthPluginOptions`
- `createCachePlugin`
- `CachePlugin`
- `CachePluginOptions`
- `CacheStore`
- `MemoryStore`
- `createLoggerPlugin`
- `LoggerPluginOptions`
- `createRateLimitPlugin`
- `RateLimitPluginOptions`
- `createRetryPlugin`
- `RetryPluginOptions`
- `createTimeoutPlugin`
- `TimeoutPluginOptions`

## GraphQL

- `gql`
- `GraphQLErrorDetail`
- `GraphQLRequestOptions`
- `GraphQLResponse`

## Transport

- `Transport`
- `FetchLike`
- `createFetchTransport`
- `fetchTransport`

## Shared Types

- `HttpMethod`
- `HeaderInput`
- `MaybePromise`
- `QueryParams`
- `QueryPrimitive`
- `QueryValue`

## Utilities

- `buildUrl`
- `isPlainObject`
- `mergeHeaders`
- `resolveUrl`
- `sleep`
