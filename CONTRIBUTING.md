# Contributing

Thanks for helping improve `@api-wrappers/api-core`. This package is the shared
HTTP runtime for the Api-Wrappers ecosystem, so changes should favor stability,
clear TypeScript types, and behavior that multiple wrapper packages can reuse.

## Before you start

- Check existing issues and pull requests to avoid duplicate work.
- Open an issue first for public API changes, behavior changes, or new built-in
  plugins.
- Keep changes focused. Runtime changes, docs changes, and release automation
  changes are easier to review when they are separate.

## Local setup

```bash
bun install
bun run verify
```

`bun run verify` runs the repository checks expected before a pull request:

- `bun run check:ci`
- `bun run typecheck`
- `bun test`
- `bun run build`
- `bun run pack:dry-run`
- `bun run smoke:package`

## Development guidelines

- Do not change the public runtime API unless the change is intentional,
  documented, and covered by tests.
- Keep strict TypeScript. Do not use `any`; prefer `unknown` with type guards
  when runtime data is uncertain.
- Prefer `Array<Type>` over `Type[]` in new public types and examples.
- Prefer const functions for new local helpers unless a declaration is clearer
  for overloads or hoisting.
- Keep Bun support working.
- Keep ESM, CommonJS, and declaration output working.
- Prefer small runtime primitives that wrapper packages can compose.
- Keep provider-specific behavior out of `api-core`; provider packages should
  own endpoint models and domain decisions.
- Add or update docs when behavior changes.

## Testing expectations

- Add unit tests for request pipeline, plugin lifecycle, retry, timeout, error,
  transport, or parsing changes.
- Use custom transports in tests instead of real network calls.
- Cover error paths, not only successful responses.
- Run `bun run verify` before opening a pull request.

## Documentation expectations

Docs should help both wrapper authors and direct users understand the runtime
contract. When adding examples:

- Use strict TypeScript.
- Avoid `any`.
- Prefer `unknown` and exported guards for error examples.
- Show the smallest complete setup that demonstrates the behavior.
- Link to deeper guides when a README example would become too long.

## Pull request checklist

- The change is scoped and explained.
- Tests or docs were added for new behavior.
- `bun run verify` passes, or the pull request explains why it could not be run.
- Public API changes are clearly called out.
- Runtime compatibility with Bun and Node was considered.

## Good first contribution areas

See [docs/contributing-ideas.md](docs/contributing-ideas.md) for starter issue
ideas that are useful without requiring deep knowledge of the whole runtime.
