# Conditional retry policies

`createRetryPlugin` accepts a `when` predicate when only some requests should use
a retry override. This is useful for APIs where reads can be repeated safely but
mutations must not be replayed after an ambiguous transport failure.

```ts
const client = createClient({
	baseUrl: "https://graphql.example.com",
	retry: { maxAttempts: 4 },
	plugins: [
		createRetryPlugin({
			maxAttempts: 1,
			when: (ctx) => ctx.tags?.includes("graphql:mutation") === true,
		}),
	],
});

await client.graphql("", {
	query: mutation,
	tags: ["graphql:mutation"],
});
```

Requests for which `when` returns false continue using the client-level retry
configuration or another matching retry plugin.
