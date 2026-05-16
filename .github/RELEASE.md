# Release Workflow

Releases are managed with Changesets and `.github/workflows/release.yml`.
Publishing only runs from `main`; pull requests never publish.

## npm Trusted Publishing

The release workflow is designed for npm Trusted Publishing with OIDC and npm
provenance. It does not require `NPM_TOKEN` when trusted publishing is
configured.

Configure the package on npmjs.com:

1. Open the package settings for `@api-wrappers/api-core`.
2. Add a GitHub Actions trusted publisher.
3. Set the repository owner and repository name.
4. Set the workflow filename to `release.yml`.
5. Set the environment name to `npm`.
6. After a successful trusted publish, set publishing access to require 2FA and
   disallow traditional tokens.

The workflow grants `id-token: write`, uses Node.js 24, verifies the npm CLI is
at least `11.5.1`, and publishes with `npm publish --provenance`. GitHub
Actions are pinned to current release tags rather than deprecated major
versions. Dependabot is configured to keep workflow action pins current.

If trusted publishing is not available, use `NPM_TOKEN` as the repository secret
name and wire it to `NODE_AUTH_TOKEN` before publishing.

## Release Steps

1. Add a changeset for user-facing changes:

```bash
bun run changeset
```

2. Merge the change to `main`.
3. The release workflow validates the package and opens a Changesets version PR.
4. Review and merge the version PR.
5. The next `main` run validates again, publishes to npm with provenance, and
   creates GitHub release notes.

Maintainers can manually run the release workflow with `dry_run: true` to verify
the install, validation, and package dry-run steps without publishing.

## CI Workflow

`.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual
dispatch. It runs:

- non-mutating Biome check
- Bun test suite
- package build
- ESM and CommonJS smoke tests
- npm package dry-run
- dependency review on pull requests

Pushes to `main` also upload a short-lived `.tgz` package artifact for manual
inspection.
