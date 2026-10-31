# @intlui/react

## Distinct language profiles

`createRendererProfiles(entries)` always includes the built-in UI profile and
registers trusted custom adapters. Each entry provides `profile: {id, version}`,
`components`, synchronous `compile(source)`, synchronous
`validateData(artifact, appData)`, and a `Renderer` component.
Compilation returns `{artifact, requiredComponents, diagnostics?}`; validation
throws or returns `false` to reject data. Unknown profiles never fall back to UI.

Create a stable registry outside React rendering. Pass
`profiles.capabilities(profile)` to `useIntluiChat` (uses protocol 0.1) and
pass `profiles` to `IntluiProvider`, `IntluiAnswer` or `DilSource`.
Direct `DilSource` also accepts `profile`; omission means the built-in UI language.
Existing `createRendererCapabilities()` uses the implicit UI protocol 0.1.

Custom renderers receive `artifact: {profile, value}` and `appData` separately.
Compilation identity stays stable on data updates. The renderer owns its runtime,
state, cleanup and `onRendered` acknowledgement, and can reuse `Tree` and contexts
from `@intlui/react/primitives`. Map and validate component properties/events.
A custom runtime is trusted code; the core does not automatically sandbox it.
Source/profile replacement requires a new block identity or explicit reset.

## Advanced components

Includes forms, textarea, date picker, radio, carousels, links, images and references,
SVG, scatter plots, timers, files, downloads, audio/video, dragging, WebGL, GeoJSON
maps, local storage and JSON sources. `createRendererCapabilities()` advertises
the full catalog; pass `components` to restrict it. Vector elements such as
`path` and `linearGradient` belong inside `svg`. LaTeX and private widgets are
not supported.

These library extensions do not guarantee equivalence with private primitives
from other products. See the [runnable gallery](../../examples/advanced/README.md).

The application resolves images; no automatic image search is performed:

```jsx
<IntluiProvider host={{
  resolveImage: async ({ref}, {signal}) => loadImageFromYourCatalog(ref, signal),
  references: {guide: {url: '/guide', title: 'Guide'}},
  onOpenImage: asset => setSelectedImage(asset)
}}>
  <IntluiAnswer state={state}/>
</IntluiProvider>
<ImageViewer asset={selectedImage} onClose={() => setSelectedImage(null)}/>
```

Import `IntluiProvider`, `IntluiAnswer` and `ImageViewer` from `@intlui/react`.
The resolver returns `{src, alt}`; `host` can also be passed directly to
`DilSource`, `DilRenderer` or `IntluiAnswer`.

Maps and JSON data require same-origin URLs. Files and storage remain in the
browser without implicit upload or synchronization. Use application-specific
storage keys. Protocol and sandbox data limits apply; do not use these controls
to transfer arbitrarily large files. WebGL shows a fallback when unavailable.
Components using browser APIs start their effects after mounting.

`@intlui/react/primitives` exports `Tree`, `AdapterContext` and `HostContext`
for integration with runtimes such as SSR. `Tree` receives a validated tree and
callback dispatcher; it does not execute DIL source. The normal React path runs
DIL in its isolated sandbox.

## Standalone chat

```jsx
import {IntluiAnswer, useIntluiChat} from '@intlui/react';
import '@intlui/react/styles.css';

function Answers() {
  const chat = useIntluiChat({endpoint:'/api/chat'});
  return <>
    <button disabled={chat.busy} onClick={() => {void chat.send('Create a checklist').catch(() => {});}}>Send</button>
    <button onClick={chat.stop}>Stop</button>
    <button onClick={chat.reset}>New conversation</button>
    {chat.error && <p role="alert">{chat.error.message}</p>}
    {chat.items.map(item => <article key={item.id}>
      <p>{item.prompt}</p><IntluiAnswer state={item.state} interruption={item.interruption}/>
    </article>)}
  </>;
}
```

`@intlui/server` supplies the route. Same-origin cookie authentication does not
need a client token; for bearer authentication pass `token`. Change `sessionKey`
when the authenticated user changes. Changing endpoint/token/session resets context.
`send` returns a Promise and also exposes errors through `chat.error`.
`contextLost` requires `reset` before continuing, without an automatic retry.
Reset clears the local view, not records already stored by the backend.

Options include `intent`, `mode` (`generate` or `translate`), `maxTurns` (20),
`capabilities` and `fetchImpl`. For the platform's `/v1/turns` route, pass
`apiBaseUrl` and `token`. Provider keys do not belong in these options.

[Complete example](../../examples/vite-node/README.md).

Part of the Apache-2.0 IntlUI Core repository. The examples and checks described here run from this repository.

Runnable host adapter example: `npm run dev:adapters` starts the CSS Modules demo
on port 5191. It uses checkbox, input, slider and select adapters with six synthetic
streaming revisions. See `examples/react-css-modules/README.md` for contracts and
verification limitations. Build it with `npm run build:adapters`.

The same dev server serves `/streaming.html`, a synthetic `IntluiAnswer` example
with separate text/data/theme controls and actual host-control render counters.
It requires no API. `IntluiAnswer` memoizes unchanged block props, so immutable
text-only state updates can skip block validation and host control rendering.
Data revisions, appearance context and changed adapters still update normally.
Keep host `components`, `classNames` and `onRendered` references stable to benefit
from this optimization; never mutate a block/appData in place. There is no global
cache and no suppression of context changes. When `onRendered` is omitted, the
answer does not install a no-op callback that schedules animation frames.
The consumer browser fixture checks render counts, data/theme propagation and
selection/frame preservation; its execution is pending in the current environment.

Independent DIL renderer with shared compiler and components. This is not
complete ChatGPT compatibility and is not a published package.

```jsx
import { IntluiAnswer } from '@intlui/react';
import '@intlui/react/styles.css';

// state is produced by @intlui/protocol createTurnState/reduceEvent.
<IntluiAnswer state={state} theme="light" />
```

The package exports compiled ESM JavaScript and CSS from `dist/`; consumers do
not need to transpile this package's JSX. `npm run build --workspace @intlui/react`
creates those files. Run the build explicitly after npm ci and after editing sources, before starting a consuming app. npm pack builds before packing.
The React tarball includes `dist/`, its manifest, README, LICENSE and NOTICE.
React/React DOM are peers; client, protocol, Acorn and Marked remain external dependencies.
The packages are not yet published to a registry.

Direct Node imports support server rendering of original text and the runtime
loading placeholder without browser globals. Interactive DIL rendering starts
only after mounting in a browser. This does not certify framework-specific SSR,
React Server Components or Next.js integration. The current peer range is React 19.

## Public surface

Type declarations are bundled for the root entry, `@intlui/react/compiler` and
the side-effect CSS import. TypeScript React consumers should install
`@types/react@^19` (an optional peer for JavaScript consumers). The compiler-only
entry does not import React types or require DOM globals. Protocol types ship
with `@intlui/protocol`.

Type declarations for the new APIs still need a dedicated TypeScript verification. See the repository STATUS.md for the current checks and gaps.

```tsx
import { DilSource, type DilComponents } from '@intlui/react';
import '@intlui/react/styles.css';

const components: DilComponents = {
  checkbox: ({ checked, disabled, onChange, children, className }) => (
    <label className={className}>
      <input type="checkbox" checked={checked ?? false} disabled={disabled}
        onChange={event => onChange(event.target.checked)} />
      {children}
    </label>
  )
};
<DilSource source="<text>Hello</text>" components={components} />;
```

Known adapter names carry specific callback types (boolean/string/number).
Additional DIL properties remain `unknown` until narrowed. Custom semantic
component names can extend `DilAdapterPropMap` by module augmentation:

```ts
import type { DilAdapterProps } from '@intlui/react';
declare module '@intlui/react' {
  interface DilAdapterPropMap {
    price: DilAdapterProps & { amount?: number };
  }
}
```

These declarations describe the supported host contract; they do not validate
model-generated DIL or incoming JSON. Continue using protocol validators and
the compiler at runtime. In particular, numeric ranges, finite numbers, source
syntax and tenant permissions cannot be guaranteed by these types.

- `IntluiAnswer({ state, theme, components, classNames, onRendered })` displays
  escaped original text, UI blocks, turn status and errors. `onRendered` receives
  `{ blockId, revision }` after two animation frames, an approximate rendering
  opportunity rather than a guaranteed paint timestamp.
- `DilSource({ source, appData, ...rendererProps })` compiles independent source.
- `DilRenderer` is the lower-level compiled-artifact renderer; prefer `DilSource`
  for source input. Only trusted host code should supply adapters/artifacts.
- `compileDil`, `parseDil`, `DilSyntaxError` expose the current compiler.
  Server code can import these from `@intlui/react/compiler` without loading
  JSX, React DOM or the browser runtime. Compilation validates the supported
  syntax; it does not execute code or verify the factual meaning of generated UI.
- `blockIdentity` exposes the protocol scope/correction key used by the renderer.

Ordinary data revisions do not recompile source, recreate the worker or clear
`DIL.useState`. Block identity includes project, conversation, turn, turnRevision
and block ID. A correction resets the runtime; removal/recreation also resets it.
Replacing source under the same active block is rejected by `IntluiAnswer`.
The standalone `DilSource` intentionally recompiles/restarts when its source is
edited. Original text remains available after compile/runtime/render errors.

Controlled inputs keep the latest locally entered value while a worker update
is in flight, then reconcile with the authoritative snapshot (including no-op
or rejected changes). This applies to reference controls and host adapters.
Callback IDs remain stable for a mounted control/property across renders and
use the latest closure; removal, source reset or execution failure retires them.

## UI adapters and Tailwind class hooks

Use `IntluiProvider` to configure appearance once for a host application:

```jsx
import { IntluiProvider, IntluiAnswer } from '@intlui/react';

<IntluiProvider theme="dark" components={myAdapters} classNames={myClasses}>
  <IntluiAnswer state={firstTurn} />
  <IntluiAnswer state={secondTurn} theme="light" />
</IntluiProvider>
```

Nested providers and renderer props override inherited settings by component
name. Classes for the same name replace, rather than concatenate, inherited
classes. An empty class string clears that hook; an explicit `undefined` adapter
restores the reference component for that name. Unspecified names inherit.
This context also applies to `DilSource` and `DilRenderer`, introduces no DOM
wrapper and does not change block identity or restart the sandbox. A host that
replaces an adapter component type can still reset that adapter's React state.
Without a provider, the existing light theme and reference controls remain.
In Next App Router, place the provider in a client component boundary.

`locale="en"` is the default on providers and individual renderers. The locale
sets the rendered language attribute; built-in labels and diagnostics are English,
including for unsupported locale values. Explicit labels and original/model text
are preserved. Host adapters can provide application-specific labels.

Turn status messages use English display labels. `data-turn-status` and protocol
state retain their original machine-readable codes. Hosts can use
`turnStatusLabel(status, locale)` for matching labels outside `IntluiAnswer`;
unknown runtime codes receive a neutral unavailable message, never a success label.

```jsx
const classNames = {
  checkbox: 'rounded border border-teal-500 p-3',
  button: 'rounded bg-teal-700 text-white px-4 py-2'
};

function Checkbox({ checked, disabled, onChange, children, className }) {
  return <label className={className}>
    <input type="checkbox" checked={!!checked} disabled={disabled}
      onChange={event => onChange(event.target.checked)} />
    {children}
  </label>;
}

<IntluiAnswer state={state} classNames={classNames}
  components={{ checkbox: Checkbox }} />
```

Adapters are trusted host React components, never source supplied by the model.
They receive semantic DIL props, `children`, `className`, `style`, normalized
`onChange(value)` and `onClick()` callbacks. Checkbox emits boolean, input/select
emit string, slider emits number. Preserve controlled values, disabled behavior,
keyboard/focus and accessible names. Do not pass a DOM event to the callback:
only cloneable semantic values cross the worker boundary.

`classNames` appends host-supplied classes per semantic component, making it
usable with an application's existing Tailwind build. This package neither
installs Tailwind nor generates CSS for arbitrary classes. The host must include
the static classes in its CSS build. DIL-specified inline dimensions/styles may
override utility classes; a custom adapter decides its own styling policy.
No official adapter compatibility for arbitrary UI frameworks is claimed.

Tailwind is a host build dependency. Include the static classes in your application build; no Tailwind-specific consumer verification is currently provided by this repository.

The reference chart accepts the same `classNames.chart` and semantic layout
styles as other components, including its unsupported-series fallback. Package
CSS is scoped to `.intl-ui`; descendant selectors use `:where(.intl-ui)` to
avoid increasing their specificity. This prevents these rules styling elements
outside the renderer, even with matching `intl-*` classes. It is not a Shadow
DOM boundary: host rules can still style elements inside the renderer.

| Control | Controlled prop | Callback value |
| --- | --- | --- |
| checkbox | `checked` | `onChange(boolean)` |
| input | `value` | `onChange(string)` |
| slider | `value` | `onChange(number)` |
| select / segmented-control | `value` | `onChange(string)` |
| button / pressable | `disabled` | `onClick()` |

The external consumer fixture tests reference controls against custom host
adapters for checkbox, input, slider, select, segmented-control and button.
It checks semantic values, basic keyboard activation, disabled controls and
per-option disabling for segmented controls. These fixtures are examples of
the adapter contract, not certified adapters for third-party UI libraries or
a complete accessibility audit.

## Accessible control names and keyboard behavior

Reference checkbox, button and pressable controls preserve visible child text
as their name and support an explicit `aria-label` when needed, for example for
an icon-only control. Segmented groups also accept `aria-label`; input, slider
and select retain their existing explicit-label support. Prefer meaningful
visible labels; a generic fallback is not a substitute for describing a control's
purpose. See the [WAI naming guidance](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/).

Select options accept `disabled: true`, as do segmented options. Reference
controls use native input/button/select semantics; host adapters must preserve
those semantics or implement their own equivalent keyboard behavior.

The external Chrome test checks computed accessible names, Tab navigation,
Space/Enter activation, slider arrows, skipping disabled options, visible focus,
and preservation of input focus/caret across three incoming data revisions.
It does not certify screen-reader compatibility, all browsers, chart data
alternatives, contrast, or complete WCAG compliance. Invalid or missing labels
in model-generated source still require review by the producer/host.

## Supported subset and execution boundaries

The independent compiler supports tags, attributes, JavaScript expressions and
declarations, conditions, loops, callbacks and a Markdown subset. Reference
controls include button, checkbox, slider, input, select and segmented control;
layout/text/table elements and bar/line/scatter charts are included. Unknown components
have a visible fallback. Mathematical content remains literal LaTeX.

Generated code executes in the isolated iframe/worker runtime, not
inside the React application. The iframe is script-only and hidden; render-tree
data/callback messages cross a MessageChannel. Browser support requires iframe
srcdoc, Workers, MessageChannel and the applicable CSP permissions for blob
workers. Parsing is not a security proof; this isolation has not had a security
audit and should not be described as production-hardened arbitrary-code hosting.
Custom host components execute normally in the application and are trusted.
This is a DOM renderer, not a Shopify account extension renderer.

The host validates worker messages before passing snapshots to React. It checks
message types, command-sequence bounds, diagnostic/error strings, plain data,
cycles, depth, tree-node counts and a total string/field budget. Malformed or
oversized messages terminate that block's transport and clear stale controls.
Tests include actual runtime snapshots and synthetic hostile messages.
These checks do not authenticate data against generated code running in the same
worker, prevent allocation during browser structured cloning, or establish a CPU/
memory security boundary. CSP inheritance and worker lifecycle still require
browser verification and a dedicated security review.

## Validation and limits

From the repository root, `npm run audit:consumer` installs all four package archives in an external temporary project, checks a simulated chat and advanced primitives, and builds Vite. It uses local dependencies/cache and does not verify registry downloads or TypeScript. Diagnostics are kept outside the repository in the system temporary directory.

`npm test --workspace @intlui/react` tests independent AST compilation, real
runtime data updates retaining checkbox state, functional updates, correction
identity and server-rendered adapters with callback/value semantics.
`npm run build --workspace @intlui/react` verifies bundling.
Browser worker lifecycle, CSS layout, focus and real interaction require the
integrated site's browser test. Node/SSR tests do not claim those passed.

No provider API, credentials, tenant authority or transport is implemented here.
The `requiredComponents` contract is enforced upstream; declared capabilities
alone are not static verification that arbitrary source uses only those tags.


## Next.js App Router

The compiled root entry preserves `"use client"`. Server Components can import
`IntluiAnswer` directly and pass serializable state. Import `compileDil` from
`@intlui/react/compiler` for server execution; the root re-export belongs to the
client boundary. Import `@intlui/react/styles.css` in the root layout.

See `examples/next-chat` for a Server Component and a client wrapper that updates
DIL data. Callbacks and custom component functions belong in a client wrapper;
they cannot be passed from a Server Component as ordinary serializable props.
The original text renders on the server, while the interactive sandbox starts
in the browser after hydration.

The example route has a Request/Response test. A complete Next.js build, hydration and browser lifecycle check remain open; the current core audit does not perform them.

## Chart data alternative

Reference bar/line/scatter charts include a keyboard-operated native disclosure below
the legend, containing a data table with caption and row/column headers.
Use `aria-label` on the chart for its name and `xAxis.label` for the category
column. The table contains the current data and series; incoming updates retain
its open state and focus while the chart remains mounted. Custom chart adapters
must supply their own accessible alternative.

Finite numbers and nonempty numeric strings are plotted. Null, missing, blank,
boolean and nonfinite values are omitted from the plot and shown as
`Data unavailable` in the table; actual zero remains zero. Empty datasets
have an explicit message. Existing size limits still apply (1000 rows/20 series).
The producer remains responsible for meaningful labels, units and a textual
explanation of trends; raw data alone is not a complete description of every
complex chart. Reference: https://www.w3.org/WAI/tutorials/images/complex/.

The external consumer accessibility test covers keyboard disclosure, computed
accessible names/headers and live updates. Node tests cover semantic markup,
missing values and malformed input. These checks are not a full WCAG or real
screen-reader certification.

## Runtime failures and recovery

A runtime error removes the previous interactive tree and shows the error plus
fallback text. It no longer leaves stale controls visible. Recoverable render
errors keep the worker session: a later valid data update can restore the UI
and its existing DIL state. Fatal errors, startup/execution timeouts and failed
message sends close the transport and remove the frame. Later messages are
ignored; the host must remount/reset the block to start a new session.

`IntluiAnswer` keeps the original answer outside the failed block. Node tests
exercise the transport with deterministic timers and the real DIL runtime's
recovery/state/callback behavior. The external browser fixture checks text,
fallback, control removal and recovery, but its latest execution is pending
because Chrome startup is unavailable in the agent environment. This is a
lifecycle correction, not a security audit of arbitrary generated code.


### Interrupted client connections

Pass `interruption="cancelled"` after a local cancellation or
`interruption="disconnected"` after an unexpected transport failure to
`IntluiAnswer`. The notice replaces the active status label while retaining the
text and mounted blocks. It does not synthesize server events, change sequence
numbers or mark the replicated state terminal. A server-terminal turn always
retains its actual outcome. Store this prop per turn and clear it for a new
request. The website and widget do this independently of their stream reducers.

The rendering tests cover both notices and terminal-state precedence. Browser
fixtures also assert cancellation notices per turn; these new browser assertions
remain unverified locally because Chrome cannot currently start in the agent
execution environment.
# Renderer capabilities

Use the library profile when constructing requests instead of copying a component
list. Website and widget clients use this same helper:

```js
import { createRendererCapabilities } from '@intlui/react/capabilities';

const capabilities = createRendererCapabilities();
const limitedWidget = createRendererCapabilities({
  surface: 'widget', components: ['text', 'checkbox'],
});
```

The subpath imports neither React nor the sandbox. Each call returns independent
arrays. Supported surfaces are `react` and `widget`; component subsets must use
unique built-in names. An empty subset disables UI translation. Math and Shopify
account surfaces are not supported by this renderer profile. Custom host adapters
do not automatically extend the profile. Declaring a subset controls negotiation,
not authorization or a sandbox security policy. The helper is also exported from
the main React entrypoint. SSR tests check every advertised component against the
native renderer; they do not certify every prop or browser interaction.

`IntluiAnswer` displays English `translation_limit` and `translation_failed`
notices. A terminal partial response containing only these known
errors is labelled as a partial interface, with a reminder to consult the original
text received. This does not assert that the source text is complete. Unknown or
mixed errors retain the generic partial-response label and their supplied message.
Cancellation, failure and local disconnection keep their own status. Presentation
does not modify protocol errors or text, restart translation, or remove blocks.
The shared renderer applies this behavior to both the website and widget.

