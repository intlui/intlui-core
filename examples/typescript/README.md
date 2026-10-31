# TypeScript consumer check

Build the packages, then run `tsc -p examples/typescript/tsconfig.json` from
the repository root with TypeScript and React 19 declarations installed.
The fixture exercises public package exports, JSX, compilation, profile lookup
and the chat hook. Expected-error cases check that invalid inputs are rejected.
It performs no model calls and does not execute the sample.

Verified with TypeScript 5.9.3 and locally available React 19 declarations on
2026-10-31, with strict checking and skipLibCheck disabled. This is a workspace
consumer check, not a fresh registry installation or exhaustive API coverage.
