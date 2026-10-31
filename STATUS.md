# Core status

The core implements standalone React chat, a server module, the UI profile and
shared primitives used by a separate SSR runtime. Custom server and React profile
adapters are supported. Version 0.2.0-beta.1 is published on npm's beta channel;
it is not a stable release.
See [test scope and limitations](TESTING.md) and [versioning](VERSIONING.md).

## Released extensibility

The published package version is 0.2.0-beta.1. Explicit protocol 0.2 accepts
application-owned surfaces; protocol 0.1 remains available for published peers.
Custom profiles supply their own component catalog, compiler, validator and
renderer. See EXTENSIONS.md. All four registry packages were installed and
verified in GitHub Actions run 41221841795 on 2026-10-31.
119 package tests, library/example builds, strict external TypeScript and an
external archive consumer passed. The user confirmed the custom profile demo's
browser interactions on 2026-10-31; see TESTING.md for scope.

## Completed checks

- All 12 stages of `npm run verify:release` passed in the user's Windows
  environment on 2026-10-31, including both Chrome browser tests, fresh external
  Next consumer installation from local archives, TypeScript and Next build.

- Protocol, client, renderer/runtime and server suites with simulated providers:
  state preservation, conversation isolation, cancellation and capability checks.
- Compilation and static rendering of advanced components; Vite gallery build.
- Archive installation in an external project, synthetic chat, advanced primitives,
  custom server/client/React profile and Vite build, using local dependencies/cache.
- Shared compiler and primitives consumed by a separate SSR runtime.
- Implicit and explicit profiles in protocol 0.1; rejection of unsupported versions,
  unknown profiles, incompatible history and invalid data.
- Synthetic JSON grammar example with shared controls and local state preserved
  through data revisions; its Vite client build.

## Remaining work

- Expand browser tests beyond the passing chat and advanced scenarios.
  Physical dragging, playback, WebGL and resource cleanup need further checks.
- Exercise the running Next.js production application. The user-run release
  verification passed the full Next.js build on 2026-10-31; this does not establish
  browser interaction with a running Next server.
- Integrate private application profiles separately. The core supplies contracts
  and a public example, not those private implementations.
- Expand CI integration coverage as appropriate. CI currently checks sources and
  publication candidates, runs package tests, and builds the library and four
  Vite demos. [GitHub-hosted checks passed](https://github.com/intlui/intlui-core/actions/runs/41221841861)
  for the 0.2.0-beta.1 release verification update.

OpenAI transport is tested with simulated responses. A live check is separate
and optional, requiring explicit credentials and budget. Ordinary checks must
not make paid calls or publish anything.

## Local artifacts

Logs, reports, test npm caches and browser profiles are written to the system
temporary directory under `intlui-core-diagnostics`. Commands print the location;
`INTLUI_DIAGNOSTICS_DIR` can override it. These diagnostics can contain local paths
and are not distributed in packages. `dist` holds builds and distributable archives;
`node_modules` contains local dependencies and installation metadata. Both are
ignored by Git. Archive contents are checked for accidental personal paths.
