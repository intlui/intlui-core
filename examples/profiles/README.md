# Application-owned surface and component

Run npm run dev:profiles from the core root and open http://127.0.0.1:5194.
The example selects protocol 0.2, surface example.dashboard, profile
example.custom-counter version 1 and component example.counter. No provider
credentials or AI calls are required. The fixed local identity is not production
authentication.

custom-counter.js owns the JSON grammar, compilation, data validation and server
instructions. custom-renderer.jsx registers its renderer and implements the
external component by composing existing Tree primitives. Click the counter
before server data changes: local interaction state is preserved across revisions.

chat-server.mjs registers both the new custom profile and the original counter
profile so legacy protocol 0.1 regression tests remain usable. main.jsx selects
the custom profile and explicitly sets protocolVersion: '0.2'.

The original counter.js and renderer.jsx demonstrate a custom grammar using only
built-in control names. They remain compatible with protocol 0.1 on the legacy
React and widget surfaces.

See ../../EXTENSIONS.md for the full extension contract and migration. To use a
real provider, replace the synthetic provider and provide server-only credentials
and application authentication. Profile modules are trusted code registered by
the host; generated content never selects modules to load.
