# Custom language profile

Run `npm run dev:profiles` from the core root and open http://127.0.0.1:5194.
`npm run build:profiles` builds the browser example. No credentials or AI calls
are required: the provider is explicitly synthetic and the server listens locally.
Its fixed demo identity is not production authentication.

The source language is JSON `{"kind":"counter","label":"Server count"}`.
It shares neither UI syntax nor its interpreter. Click the button before the
server count changes: local clicks belong to the same renderer state owner.

`counter.js` provides the descriptor, compiler, schema validator and server
instructions. `renderer.jsx` registers the client adapter and maps its data to
`Tree` primitives. `chat-server.mjs` registers only this profile. `main.jsx` selects
its capabilities and passes the same registry to `IntluiAnswer`.

```jsx
const profiles = createRendererProfiles([counterRenderer]);
const capabilities = profiles.capabilities(counterRenderer.profile);
const chat = useIntluiChat({endpoint:'/api/chat', capabilities});
// For each received item:
<IntluiAnswer state={item.state} profiles={profiles}/>
```

On the server, use `createChatHandler({provider, authenticate,
profiles:[counterServer]})`. To allow UI as well, register `createUiProfile()`
alongside the custom adapter. Registering one side does not register the other.
The hook uses protocol `0.1` for explicit profiles as well. Plain
`createRendererCapabilities()` continues to use the legacy implicit UI profile.

For OpenAI, replace the synthetic provider with `createOpenAiProvider` and supply
server-only credentials, a model and real application authentication as shown
in `../vite-node`. The selected adapter supplies the translation instructions;
`createOpenAiProvider({instructions})` configures original text generation.
Validate the custom grammar and every data revision independently of the model.
Never load an adapter or executable code named in a model response.

Keep the registry stable. Source/profile changes require a new block identity or
an explicit reset; data updates must reuse the existing runtime. Custom renderers
receive a profile-tagged artifact and own their execution, cleanup and callbacks.
Use `IntluiProvider profiles={profiles}` to provide a registry across the tree,
or pass `profiles` directly to `IntluiAnswer` / `DilSource`.
