# React host adapters with CSS Modules

Run `npm run dev:adapters` from the workspace root and open http://127.0.0.1:5191.
`npm run build:adapters` builds this example in its local `dist/` directory.
No backend, API key or paid model is used. The interface labels the synthetic stream.

Also available at http://127.0.0.1:5191/streaming.html: a separate answer with
text-only events, UI data updates and provider theme changes. Select its checkbox,
then add text; the displayed render counters should remain unchanged. Updating
UI data or theme should update the interface while retaining selection. These
are actual counters, not prerecorded performance numbers. Browser behavior has
not yet been verified in this environment. `build:adapters` builds both pages;
the streaming fixture is local to this example and has no private dependencies.

Change the checkbox, project name, budget and plan while six data revisions arrive.
All revisions use the same turn and block; the DIL runtime owns the control values.
Switching theme preserves that identity. The new-response button intentionally
uses a new turn ID and resets state. Switching adapters can remount host controls
(including focus), while runtime-owned values remain available.

`adapters.jsx` contains host-owned React controls styled by actual CSS Modules.
Keep their component references stable, convert DOM events to boolean/string/number
values before calling onChange, and forward only known DOM attributes. Browser
events and DOM nodes must not cross into the runtime worker.

These are not MUI, Radix or Chakra components. Those libraries still need reviewed
wrappers and version-specific tests. This example is separate from Tailwind/Next.

The automated React test compiles this exact source, invokes host handlers,
advances all protocol revisions and checks values and callback identity. SSR checks
transformed CSS classes and disabled controls. The Vite build verifies bundling.
Visual appearance, keyboard focus and iframe interaction still require browser
acceptance; the non-browser checks do not certify them.
