# IntlUI Core

This repository contains the public protocol, client, renderer, server and authored
examples. Keep provider credentials, customer data, captures, browser profiles,
private platform code and legal due-diligence material out of this repository.
The sibling research and product repositories are not build dependencies.

Keep internal legal reviews and file inventories in the private repository.
Use ES modules and two-space indentation. Run npm run check,
npm test and npm run build after implementation changes. No paid calls or
publication as a side effect of checks.

## Versioning and releases

Follow VERSIONING.md. Update code, types, examples, fixtures and docs together.
Dependencies and deliberately invalid versions in tests are not project releases.
Follow the documented SemVer and protocol compatibility
rules; never silently change a published contract or rewrite a released tag.
GitHub source publication and npm publication are separate actions. Keep npm
packages private until an npm release is explicitly authorized. Preparing a
release does not authorize pushing, tagging, deploying or publishing it.

## Verification and public contents

Do not describe the suite as complete or 100% coverage without measured evidence
and explicit scope. Record untested browser, framework and provider behavior in
TESTING.md and STATUS.md. Add regression tests for changed boundary behavior.
Use only synthetic fixtures. Keep diagnostics in the system temporary directory.
Before GitHub publication, run the release checks in CONTRIBUTING.md, inspect
the exact Git candidate files, and verify LICENSE/NOTICE are included. Do not
copy private specifications or add provenance inventories and local machine paths.

## Language

Write all repository documentation, comments, identifiers, test descriptions,
fixtures, examples, prompts, diagnostics and built-in interface text in English.
English is the default interface language. Preserve Unicode test coverage with
language-neutral symbols or English text; do not restrict user content to ASCII.
