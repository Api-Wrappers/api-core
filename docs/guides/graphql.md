# GraphQL

`client.graphql()` sends a GraphQL operation through the same request pipeline
as REST calls. Auth, retry, timeout, rate-limit, cache, logging, and custom
plugins all still apply.

## Basic Query

```ts
const data = await client.graphql("/", {
	query: `
		query {
			Viewer { id name }
		}
	`,
});
```

## Typed Query And Variables

```ts
interface GetMediaQuery {
	Media: {
		id: number;
		title: { romaji: string };
	};
}

interface GetMediaVariables {
	id: number;
}

const data = await client.graphql<GetMediaQuery, GetMediaVariables>("/", {
	query: `
		query GetMedia($id: Int) {
			Media(id: $id) {
				id
				title { romaji }
			}
		}
	`,
	variables: { id: 1 },
	operationName: "GetMedia",
});

data.Media.title.romaji;
```

## GraphQL Errors

GraphQL responses with an `errors` array throw `GraphQLRequestError`, even when
the response also contains partial data.

```ts
import { GraphQLRequestError } from "@api-wrappers/api-core";

try {
	await client.graphql("/graphql", { query });
} catch (error) {
	if (error instanceof GraphQLRequestError) {
		console.log(error.graphqlErrors);
		console.log(error.partialData);
	}
}
```

HTTP-level failures still throw `ApiError`, `RateLimitError`, or `TimeoutError`.

## Caching GraphQL Requests

GraphQL requests are POST requests, so the cache plugin does not cache them by
default. Use an explicit `cacheKey` when the operation is safe to cache.

```ts
await client.graphql<GetMediaQuery, GetMediaVariables>("/", {
	query: GET_MEDIA,
	variables: { id },
	cacheKey: `gql:GetMedia:${id}`,
	tags: ["media"],
});
```
