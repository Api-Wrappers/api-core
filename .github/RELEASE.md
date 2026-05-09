# Release Workflow

Releases are published by `.github/workflows/release.yml` when a semver tag is
pushed, for example `v1.2.3`.

## npm Trusted Publishing

The release workflow is designed for npm Trusted Publishing with OIDC. It does
not use `NPM_TOKEN`.

Configure the package on npmjs.com:

1. Open the package settings for `@api-wrappers/api-core`.
2. Add a GitHub Actions trusted publisher.
3. Set the repository owner and repository name.
4. Set the workflow filename to `release.yml`.
5. Set the environment name to `npm`.
6. After a successful trusted publish, set publishing access to require 2FA and
   disallow traditional tokens.

The workflow grants `id-token: write`, uses Node.js 24, and verifies the npm CLI
is at least `11.5.1`, matching npm's trusted publishing requirements.
GitHub Actions are pinned to current release tags rather than deprecated major
versions. Dependabot is configured to keep workflow action pins current.

## Release Steps

1. Update `package.json` version.
2. Commit the version change.
3. Create and push a matching tag:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The workflow checks that `package.json` version matches the tag without the
leading `v`, runs lint/tests/build, verifies package contents, publishes to npm,
and creates a GitHub release with generated notes.

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
