# Contributing Ideas

These are starter issue ideas for contributors who want to help improve
`@api-wrappers/api-core` without changing the public runtime API first.

## Documentation

- Add one focused example per built-in plugin showing the smallest useful
  wrapper setup.
- Expand the custom transport guide with a deterministic test transport and a
  tracing transport example.
- Add a guide for choosing between global retry config and `createRetryPlugin`.
- Add a guide for using exported error guards with `unknown` catch values.
- Add a compatibility note for Bun, Node, browsers, and edge runtimes.

## Tests

- Add more tests for mixed header input shapes: plain objects, `Headers`, and
  tuple arrays.
- Add tests for plugin ordering when multiple plugins update request metadata.
- Add tests for GraphQL partial data with errors.
- Add tests for retry behavior with `retry-after` HTTP-date values.
- Add tests for custom fetch receiving the final normalized request options.

## Developer experience

- Improve error messages in docs by showing common causes and fixes.
- Add examples that compare direct `fetch` code with the equivalent `api-core`
  client setup.
- Add a contributor checklist for adding a new built-in plugin.
- Add release verification notes for package exports and declaration files.

## Good first issues

- Clarify one confusing paragraph in the docs and open a small pull request.
- Add a missing cross-link between README sections and deeper docs pages.
- Improve a test name so the behavior under test is easier to understand.
- Add one example that uses `unknown` in a `catch` block with an exported type
  guard.

## Larger follow-up issues

- Create a full transport guide with production, testing, and observability
  examples.
- Audit docs for wrapper-author language and make terminology consistent.
- Add a public API review checklist for future runtime changes.
- Build a compatibility matrix for supported runtimes and TypeScript versions.
