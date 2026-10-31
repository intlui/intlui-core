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

## Preparing GitHub publication

- Review LICENSE, NOTICE, README, VERSIONING, TESTING and STATUS.
- Run the checks above and `npm run check:publication` to inspect candidate files.
- Inspect `git status --short` and the staged diff before the first commit.
- Publish source only: exclude dependencies, builds, archives, diagnostics,
  environment files other than `.env.example`, and private research/material.
- Set the actual GitHub owner and repository when configuring the remote. Do not
  invent repository, homepage or issue URLs in package metadata.
- GitHub publication and npm releases are separate; do not remove `private: true`
  as part of ordinary checks. The four library packages are explicitly configured
  for public beta publication; the root and examples remain private.

## npm beta publication

The manually dispatched `publish.yml` workflow publishes all four packages in
dependency order using npm trusted publishing. Configure each package's trusted
publisher with organization `intlui`, repository `intlui-core`, workflow filename
`publish.yml`, no environment, and permission to publish directly. No npm token
is stored in the repository.

For the first release, use `bootstrap-npm.yml` (Stage first npm beta). Create a
short-lived npm granular token with read/write stage-only access to the `@intlui`
scope and store it as the GitHub Actions repository secret `NPM_BOOTSTRAP_TOKEN`.
Do not put it in source, logs or chat. The workflow grants the token only to the
staging step, after checks/builds. It has no OIDC permission. npm 11.15+ is required;
the workflow installs the current npm 11 release.
Run it manually on main, then approve the four beta versions in npm's Staged
Packages tab using 2FA. Staging a new name creates a public `0.0.0-stage`
placeholder; actual beta contents remain staged until approval. Configure the
trusted publishers above for later releases, then revoke the bootstrap token and
delete its GitHub secret. New trusted publisher configurations must be validated
by a successful publish within npm's documented expiry period (currently 2 days).
See https://docs.npmjs.com/staged-publishing/ and
https://docs.npmjs.com/trusted-publishers/ for the account-side setup.
Publishing is not transactional: if it fails partway, inspect which versions exist
before retrying. Never overwrite published versions. GitHub tags/releases are
created separately once all four npm packages have been verified.

Release checks require no model calls. `audit:consumer` uses local cached packages
and reports that limitation; it is not a fresh-registry installation test.
