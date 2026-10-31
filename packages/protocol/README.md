# @intlui/protocol

## Language profiles

Protocol `0.1` supports implicit UI or an explicit language selection.
An explicit selection requires `capabilities.profile: {id, version}` in requests and
`profile` on created blocks. Both descriptor fields are bounded identifiers;
unknown fields are rejected. `UI_PROFILE` identifies `intlui.ui` version `0.1`.
`PROTOCOL_VERSION` is `0.1` for both modes.

Use `createTurnState(scope, capabilities, request.version)` and `reduceEvent` to
reject unsupported protocol versions, profile substitutions and mismatched capabilities.
`ui.data` preserves the source and profile. The wire format remains `dil`;
profile-specific compilers interpret its opaque source. `profileKey` and
`sameProfile` compare validated ID/version pairs. Registration and authorization
belong to the server, not this package.

Part of the Apache-2.0 IntlUI Core repository. Run npm test and npm run check in the core root.

The package includes TypeScript declarations for requests, capabilities, blocks,
discriminated events and turn state. Validators accept `unknown` and return a
validated typed value or throw; they are not boolean type guards. Use their
return value before passing untrusted data to the reducer:

```ts
import { validateEvent, reduceEvent, type TurnState } from '@intlui/protocol';
function apply(state: TurnState, incoming: unknown): TurnState {
  return reduceEvent(state, validateEvent(incoming));
}
```

Static types do not replace runtime checks for IDs, limits, finite JSON numbers,
event ordering or authorization. A dedicated TypeScript check of the new APIs remains open; see the repository STATUS.md.

Treat `createTurnState`/`reduceEvent` output as immutable. Do not mutate its blocks,
data, capabilities or counters, and do not inject an unvalidated hydrated state.
Apply protocol events to update it. Each incoming event is still validated; the
200,000-character aggregate UI limit is checked when blocks change. Text/status/
error/terminal events retain the already-checked block array without serializing
it again. This avoids work proportional to UI size for every text fragment while
preserving limits on create/data events. The package tests verify reducer behavior; they do not establish browser rendering performance or provider latency.

Foundation package for the IntlUI product protocol **0.1**, not the
ChatGPT DIL protocol. No dependencies, provider calls, renderer or authentication
implementation. Run `npm test --workspace @intlui/protocol` from the monorepo,
or `npm test` in this directory (Node 22+).

## Request and server context

`validateRequest` accepts exactly `version`, `requestId`, `intent`, `input` and
`capabilities`. `input` has `mode: generate | translate` and `text`. Both intent
and input text are nonempty and at most 30,000 UTF-16 code units. Intent selects
presentation; it is not evidence for missing facts. `requestId` is correlation,
not an implemented idempotency guarantee.

Tenant, project, credentials and principal are not accepted request body fields.
The API must resolve the selected project through verified credentials and
membership before creating a turn. `validateResolvedContext` only checks the
shape `{organizationId, projectId, principalId, environment}` (`development` or
`production`). Passing this validator does **not** authenticate or authorize
anyone. Never construct an authoritative context by copying browser fields.

Capabilities have `surface`, `formats` and `components` (up to 128 unique names). Surfaces are `react`,
`widget`, `shopify-account`, `text`. The only UI format currently defined is
`dil`; text-only clients advertise empty lists. Shopify account is text-only
in this foundation until a separately validated declarative adapter exists.
`supportsBlock` compares declared requirements only; it does not inspect DIL.

## Events

Every event contains `version: '0.1'`, `projectId`, `conversationId`, `turnId`,
`sequence` (starts at 1), `turnRevision` (starts at 0), and `type`.
Unknown fields/types/versions are rejected. IDs use 1–128 ASCII letters, digits,
dot, underscore, colon or hyphen and start with a letter or digit.

| Type | Additional fields | Meaning |
| --- | --- | --- |
| `text.delta` | `text` | Append original text. |
| `ui.create` | `block` | Create a new block, starting at revision 1. |
| `ui.data` | `id`, `revision`, `appData` | Replace full data; increment revision by one. |
| `ui.remove` | `id` | Remove an existing block; renderer must dispose its state. |
| `turn.reset` | `text` | Explicit correction; increment turnRevision by one, clear blocks/errors. |
| `status` | `status` | `receiving` or `translating`; never terminal. |
| `error` | `code`, `message`, optional `blockId` | Report a failure without automatically ending the turn. |
| `turn.end` | `status`, optional `reason` | `complete`, `partial`, `cancelled`, `failed`; reason required unless complete. |

A block has `id`, `format: 'dil'`, `source`, `appData`, `revision`,
`requiredComponents`. Source is nonempty and at most 50,000 UTF-16 code units.
Data is a JSON object with finite values, maximum depth 24, 10,000 visited nodes,
and serialized length at most 60,000 code units. Reserved prototype keys are
rejected. Declaration of required components is not compiler validation: the
producer must validate source and derive truthful requirements separately.

There is no source replacement operation. Add another block when needed while
keeping existing interactive IDs/source stable. Removing and recreating a block
discards user state and is not a state-preserving layout migration.

## Reducer and lifecycle

`createTurnState(scope, capabilities)` binds one project/conversation/turn.
`reduceEvent(state, event)` returns new replicated state, rejecting mismatched
scope, sequence gaps/duplicates, stale turn revisions, duplicate blocks and
skipped data revisions. It retains source/identity on data updates. User input
state belongs to the renderer and is deliberately absent from this state.

Maximums: 30,000 text code units per turn revision, 24 active blocks, 200,000
serialized block code units and 100 error records. Unsupported capabilities
reject the operation: the producer must emit text fallback rather than silently
claiming success. Original text should always be delivered independently.

`turn.reset` is intentionally destructive correction and clears UI state. Sequence
continues monotonically across resets. Terminal states cannot be reopened; late
events (including resets) are rejected. Start a new turn for later output.
Replay/resume must begin from a trusted snapshot or replay the whole stream;
gap recovery, deduplication and persistence are not provided here.

This reducer is not a session authority, DIL compiler, sandbox, billing system,
HTML sanitizer or transport parser. JSON framing, network limits, signature
checks, action authorization, actual UI capabilities, access control, retention,
usage accounting and multi-turn recovery belong to subsequent packages.
The research prototype's `interrupted` status maps to `turn.end/cancelled` only
through an explicit adapter; its events do not already satisfy this envelope.

## Fixtures and tests

`fixtures/progressive.json` is synthetic, contains no credentials, and demonstrates
text arriving around a block update. Tests also cover cancellation, correction,
provider failure, foreign scope rejection and text-only capability fallback.
Passing them verifies protocol behavior, not usable UI or tenant security in a
real backend. Any incompatible schema change must change the protocol version
and update all consuming agents' fixtures together.
