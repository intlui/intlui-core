# Application-owned extensions

Available in npm 0.2.0-beta.1, not in 0.1.0-beta.1.

A surface identifies the host, for example `example.dashboard` or `example.native`.
In wire protocol 0.2 it is a bounded identifier, not a core registry entry and not
a permission. A text-only host declares empty formats and components. A UI host
declares the components it actually implements. No vendor-specific surface rules
apply in 0.2.

A language profile is an exact `{id, version}` contract. Its adapter owns source
compilation, required component names, data validation and rendering. It can live
in an application or a separately versioned package without changing core.
The existing wire format name remains `dil`; custom profiles may use a different
source grammar inside that envelope. Arbitrary new wire formats are not added.

## Register both sides

The runnable example in `examples/profiles` uses the external component
`example.counter` on `example.dashboard`. Its JSON grammar, compiler and validator
live in `custom-counter.js`; its React implementation is in `custom-renderer.jsx`.
The adapter composes existing primitives, but can render its own React components.

```jsx
import {useIntluiChat, IntluiAnswer} from '@intlui/react';
import {profile} from './custom-counter.js';
import {profiles} from './custom-renderer.jsx';

const capabilities = profiles.capabilities(profile, {surface: 'example.dashboard'});
function Chat() {
  const chat = useIntluiChat({endpoint: '/api/chat', protocolVersion: '0.2', capabilities});
  return <>{chat.items.map(item =>
    <IntluiAnswer key={item.id} state={item.state} profiles={profiles}/>
  )}</>;
}
```

```js
import {createChatHandler} from '@intlui/server';
import {serverProfile} from './custom-counter.js';

const handler = createChatHandler({
  provider, authenticate, profiles: [serverProfile],
  // Optionally authorize profile use for the authenticated caller.
});
```

`provider` and `authenticate` are application-owned implementations. The server
adapter supplies `profile`, `instructions`, `compile` and `validateData`. The
client supplies the same profile identity plus `components`, `compile`,
`validateData` and `Renderer`. Compiled requirements must fit the client's declared
catalog. Unknown profiles, undeclared requirements and invalid data fail closed;
changing a surface name cannot bypass those checks.

Only register trusted application modules. Never load a module URL supplied by
generated content. Client capabilities do not authenticate or authorize callers.
Keep interactive state in the renderer; incoming data revisions must not recreate
that state. A renderer for a non-DOM host is the extension author's responsibility.

## Existing UI adapters

Use `components` and `classNames` to customize built-in UI controls. These overrides
do not add names to the default server UI profile. For new component names or a
different grammar, register a custom profile on both sides. The built-in catalog
stays explicit so applications never advertise implementations they do not have.

## Migration

- Upgrade all four packages together to 0.2.0-beta.1.
- Existing clients may continue using wire protocol 0.1. `PROTOCOL_VERSION` and
  the chat hook's default remain 0.1 to avoid silently switching existing peers.
- For new surfaces, set request `version: '0.2'`, or hook `protocolVersion: '0.2'`.
  `EXTENSIBLE_PROTOCOL_VERSION` exports this value. Upgrade the server first:
  0.1.0-beta.1 peers reject 0.2 explicitly; there is no automatic downgrade.
- `validateCapabilities(value)` validates 0.2. Pass `'0.1'` as its second argument
  when checking legacy inputs outside `validateRequest`.
- Pass the request version to `createTurnState`. Events must keep that version
  throughout the turn; the reducer rejects version substitution.
- Keep profile versions independent of package and wire versions. A new surface
  does not require a new grammar version. Breaking grammar changes do.

Historical vendor names exist only in the frozen 0.1 compatibility rules/tests.
They are not registered integrations or implied support in protocol 0.2.

Run `npm run dev:profiles` for the synthetic local demo, or `npm run build:profiles`
to build it. No live provider calls are needed.
