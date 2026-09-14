# Exports

## Client

- `createClient`
- `BaseHttpClient`
- `RequestOptions`
- `ResponseType`
- `ApiResponse`
- `ClientConfig`
- `LoggerInterface`
- `RetryConfig`

## Context

- `RequestContext`
- `ResponseContext`

## Errors

- `ApiError`
- `ApiErrorDetails`
- `responseErrorDetails`
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
- `createHeaderRateLimitPlugin`
- `HeaderRateLimitPlugin`
- `HeaderRateLimitPluginOptions`
- `HeaderRateLimitState`
- `RateLimitResetFormat`
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
- `dedupeGraphQLFragmentDefinitions`
- `graphqlWithResponse`
- `GraphQLApiResponse`
- `GraphQLClientLike`
- `createGraphQLRequester`
- `CreateGraphQLRequesterOptions`
- `GraphQLRequester`
- `GraphQLRequesterOptions`
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
