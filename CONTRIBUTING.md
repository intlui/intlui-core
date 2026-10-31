# Contributing

Use Node.js 22+ and npm. Clone this repository and run `npm ci`. No sibling
repository, private specification or provider key is needed for ordinary work.
See VERSIONING.md before changing any version. Use synthetic fixtures and keep
private data and credentials out of code, screenshots, issues and commits.

Before proposing a change:

```sh
npm run check
npm test
npm run build
npm run build:chat
npm run build:adapters
npm run build:advanced
npm run build:profiles
npm run audit:consumer
```

Add regression tests for changed behavior and boundary cases. Explain what changed,
why, how it was tested, and any unverified behavior. See TESTING.md for the limits
of these checks; a successful build does not prove browser behavior.

## Updating the public repository

- Review LICENSE, NOTICE, README, VERSIONING, TESTING and STATUS.
- Run the checks above and `npm run check:publication` to inspect candidate files.
- Inspect `git status --short` and the staged diff before each commit.
- Publish source only: exclude dependencies, builds, archives, diagnostics,
  environment files other than `.env.example`, and private research/material.
- The public repository is https://github.com/intlui/intlui-core. Keep package
  repository, homepage and issue URLs consistent with that location.
- GitHub publication and npm releases are separate; do not remove `private: true`
  as part of ordinary checks. The four library packages are explicitly configured
  for public beta publication; the root and examples retain `private: true` to
  prevent npm publication. This does not mean their source is private.

## npm beta publication

The manually dispatched `publish.yml` workflow publishes all four packages in
dependency order using npm trusted publishing. Configure each package's trusted
publisher with organization `intlui`, repository `intlui-core`, workflow filename
`publish.yml`, no environment, and permission to publish directly. No npm token
is stored in the repository.

Trusted Publishing was validated by the 0.2.0-beta.1 publication. The workflow
verifies a fresh registry installation after publishing, allowing time for npm
version and tag propagation. If only verification fails, run `verify-npm.yml`
again; do not repeat publication of an existing version.

The first release used `bootstrap-npm.yml` to stage the packages. That bootstrap
is complete: the temporary token was revoked and its GitHub secret removed.
Routine releases use `publish.yml` and do not require recreating that token.

Publishing is not transactional: if it fails partway, inspect which versions exist
before retrying. Never overwrite published versions. GitHub tags/releases are
created separately once all four npm packages have been verified.

Release checks require no model calls. `audit:consumer` uses local cached packages
and reports that limitation; it is not a fresh-registry installation test.
