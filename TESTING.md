# Test scope and evidence

The suite is **not complete across the whole project**. Passing tests establish
the behaviors exercised, not the absence of all defects or 100% coverage.
Ordinary tests use synthetic providers and make no paid calls.

| Area | Exercised cases | Remaining limits |
| --- | --- | --- |
| Protocol | Ordering, duplicates, foreign scopes, revisions, terminal events, resets, JSON limits, reserved keys, profile mismatch, unknown versions, sparse arrays, exact size boundaries | No exhaustive fuzzing or formal proof |
| Client | Split UTF-8/SSE, cancellation, stalled readers, error sanitization, no automatic retry, bounded queues, transcript/Realtime event filtering and disposal | Simulated upstream transports; no live OpenAI verification |
| Server | Authentication, origins, quotas, owner-scoped history, duplicate admission, disconnect, memory-store limits, invalid translations, profile authorization and schema validation | No distributed-store or sustained production load test |
| React/runtime | Compilation, static rendering, callback identity, stale callbacks, worker validation and cleanup; Chrome chat hydration, controls, streaming state, history and reset | Single Chrome environment; no exhaustive iframe or GPU validation |
| Advanced components | Static tag rendering and compilation; Chrome form state across data updates, timer, local data and map rendering | Physical drag, media playback, browser resource cleanup and WebGL need more integration tests |
| Custom profiles | Different grammar, unknown versions, data rejection, one state owner, shared primitives, source/profile immutability | Private application integrations are outside this repository |
| Packaging | Four archives installed outside the workspace, licenses, public exports, synthetic chat, custom profile, Vite build; fresh registry dependency installation in the Next consumer | IntlUI itself installed from local archives, not npm-published packages |
| Next.js / TypeScript | Next route runs with Request/Response; full Next production build; strict TypeScript consumer checks public exports, JSX and invalid inputs | Running Next production-server browser exercise and exhaustive declaration coverage remain unverified |

## Reproducing checks

For a guided local release check, run `npm run verify:release` with Node.js 22+,
npm, internet access and Chrome installed. It installs core dependencies using
`npm ci`, then runs source/publication checks, unit tests, builds and browser
checks. Browser tooling and a fresh Next.js consumer are installed in a unique
system temporary directory. The consumer installs the four local archives from
this checkout and checks TypeScript and a production Next build. It never
publishes or calls a paid provider. Set `CHROME_PATH` for a non-default browser.
The command prints progress and the paths to `summary.txt`, `summary.json` and
individual logs. Failed independent checks do not prevent later checks; missing
prerequisites stop their dependent checks. A nonzero exit means the run did not
fully pass. This does not test a running Next production server.

The current local package run exercises 113 tests: protocol 17, client 30,
React 45 and server 21. Counts are a snapshot, not a completeness target.

`npm test` runs all four package suites; React builds first. `npm run test:coverage`
runs those tests with Node V8 coverage and writes per-package reports under the
system temporary directory. Reports include executed test files, bundled code and
modules loaded by Vite; their aggregate percentages are **not** a whole-project
coverage metric. JSX transformed by Vite and browser execution need separate
instrumentation. No unmeasured global percentage or coverage threshold is claimed.

Build all four examples using the commands in CONTRIBUTING.md. Run
`npm run audit:consumer` to test the archived packages independently of workspace
links. `npm run check:publication` checks Git candidate files and version consistency;
its credential patterns are heuristic, not a security audit.

## Browser and environment limitations

`npm run test:browser:chat` and `npm run test:browser:advanced` require Chrome;
set `CHROME_PATH` when it is not at the platform default. They are separate from
unit tests and do not constitute comprehensive cross-browser coverage.

On 2026-10-26 the chat browser attempt failed at CDP `Page.enable` with a timeout,
before its assertions ran. It is not a passing browser result. TypeScript tooling
installation was attempted from cache (missing packages) and registry (EACCES);
that attempt did not establish a successful TypeScript check.

On 2026-10-31, the chat retry again timed out at CDP `Page.enable`, before
assertions; the advanced browser also timed out during browser startup. Next.js
was not available locally, and npm registry access again failed with EACCES.
Those agent attempts did not verify the Next build or browser behavior. Locally available
TypeScript 5.9.3 and React 19 declarations did allow strict declaration checking
and the consumer fixture in `examples/typescript` with skipLibCheck disabled.
This does not verify fresh registry installation or every exported signature.

The `Core checks` workflow runs source/publication checks, package tests, the
library build and four Vite example builds. It does not publish or call live model
providers. [GitHub-hosted execution passed](https://github.com/intlui/intlui-core/actions/runs/41221841861)
for the 0.2.0-beta.1 release verification update. The separately dispatched
`publish.yml` workflow publishes through npm Trusted Publishing.

## Subsequent user-run verification — 2026-10-31

All 12 release-runner stages passed: core dependency installation, source and
publication checks, unit tests, build, browser tooling installation, both browser
tests, archive creation, fresh external Next consumer installation, TypeScript
consumer and Next production build. The saved summary.json was inspected.
These results supersede the earlier failed attempts. The advanced test explicitly
selects and replaces initial textarea text before checking state preservation.
The publication check trusts only the script's checkout for its read-only Git
invocation, without changing global Git settings.
Next production-server interaction, physical dragging, playback, GPU behavior
and broader browser coverage remain outside the passing checks.

## 0.2.0-beta.1 extensibility checks

On 2026-10-31: 119 package tests passed, including explicit 0.2 request/event
matching, frozen 0.1 restrictions, application-owned surface/component round trips,
undeclared component rejection, profile rendering and chat protocol selection.
Public-boundary and publication-candidate checks passed. The library and custom
profile demo built successfully. An independent consumer installed all four npm
archives, exercised protocol 0.2 with an external surface/component and passed
strict TypeScript checks against the new declarations. Third-party dependencies
and TypeScript tooling came from existing local installations; this is not a
registry publication check.

The user manually verified the new profile demo in the browser on 2026-10-31,
including local counter state across data revisions and reset. This is manual
validation, not automated browser coverage. Older-peer interoperability over a
real network has not been exercised. Legacy behavior is covered by unit tests;
no live provider calls were performed for this change.

All four 0.2.0-beta.1 packages were subsequently published using Trusted Publishing
on 2026-10-31. The first verification ran before registry propagation completed;
verification now polls pending versions/tags with bounded retries. The separate
[registry verification](https://github.com/intlui/intlui-core/actions/runs/41221841795)
passed: beta tags and integrity, fresh registry installation, package imports,
compiler and static React rendering. No publication retry was needed.
