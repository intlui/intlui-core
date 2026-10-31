# DIL profiles and shared components

The core supports profiles with different syntax, compilation, data validation
and renderers. The built-in UI profile is `intlui.ui`, version `0.1`.
Profile versions are independent of protocol versions and React/widget surfaces.
A component catalog alone does not define a grammar.

## Available contracts

- `@intlui/protocol`: profile identity, events, blocks, revisions and capabilities.
- `@intlui/client`: transport, streaming and cancellation for implicit or explicit profiles.
- `@intlui/server`: adapter selection, compilation and validation of each creation
  and update before emission. Server-owned translation instructions are separate
  from original text generation instructions.
- `@intlui/react`: `createRendererProfiles` registry, profile compilation, data
  validation and renderer selection. The UI profile is included.
- `@intlui/react/primitives`: `Tree`, host contexts and shared controls without
  requiring the UI compiler or runtime.

## Selection and compatibility

Protocol `0.1` supports implicit UI or an explicit profile. Explicit selection uses
`capabilities.profile: {id, version}` in requests and the same `profile` on created
blocks. Events retain the requested protocol version. `format: 'dil'` identifies
the envelope; the profile defines its grammar. The reducer rejects unsupported
versions and mismatched profiles.

The client selects exactly one server-registered profile. There is no discovery
endpoint or automatic selection. Unknown IDs/versions are rejected before provider
calls, without a UI fallback. `authorizeProfile` can restrict access using the
authenticated identity. The model cannot choose profiles, modules, URLs or code
to load.

Block profile and source are immutable. `ui.data` changes data without compilation.
Server history is associated with a profile. Using another profile returns
`conversation_profile_mismatch` and requires a new conversation. Records without
a profile mean UI version 0.1. External endpoints must register the profiles they
accept.

## Adapters

A server adapter contains `profile`, `instructions`, `compile(source, context)`
and `validateData(artifact, data, context)`. Compilation returns
`{artifact, requiredComponents}` and may be asynchronous. Context includes
`signal`; validation also receives `previousAppData` for updates. Returning
`false` or throwing rejects the data. Artifacts remain on the server and are
not exposed to the model. Protocol JSON limits apply to custom profiles too.
The UI profile enforces JSON limits rather than an application-specific data schema.

A React adapter contains `profile`, `components`, `compile`, `validateData`
and `Renderer`. Client compilation and validation must be synchronous.
Renderers receive `artifact: {profile, value}` and `appData` separately, along with
appearance props and `onRendered`. Compilation occurs only when source, profile
or registry changes. The renderer owns its runtime, preserves state through data
revisions and acknowledges applied updates through `onRendered`. Create the
registry outside React rendering to keep its identity stable.

Adapters are trusted application modules. The core does not automatically isolate
custom runtimes: each integration must choose constrained execution or isolation
appropriate to its grammar. The UI runtime retains its sandbox. A data-only grammar
does not require executing generated JavaScript.

## Reusing components

`Tree` receives a validated tree from the profile runtime. The adapter converts
properties and events to primitive contracts and forwards callbacks to its own
runtime, without introducing a second state owner. `Tree` is not a validator.
Identical component names do not guarantee compatible properties. Geometry,
specialized assets and graphics engines belong in integration packages.

The core does not depend on private specifications or runtimes. Private packages
can depend on the core and register their adapters. Private profiles are not
automatically included in public packages.

The [runnable example](examples/profiles/README.md) demonstrates a synthetic JSON
grammar, server, chat and shared controls with one state owner.
