# IntlUI

Published npm beta release: 0.2.0-beta.1. [Validation and remaining work](STATUS.md) ·
[Language profile architecture](ARCHITECTURE.md).

React chat with text responses and interactive DIL interfaces, running on your
server with your OpenAI key. No IntlUI account or hosted service is required.
Protocol 0.1 supports implicit UI or explicitly selected language profiles.

| Package | Purpose |
| --- | --- |
| `@intlui/react` | Renderer, components and `useIntluiChat` hook |
| `@intlui/client` | Streaming, cancellation and backend transport |
| `@intlui/server` | HTTP handler, conversations, OpenAI and DIL translation |
| `@intlui/protocol` | Shared events and validation |

## Try the chat

With Node.js 22 or later, from the repository root:

```sh
npm ci
npm run dev:chat:demo
```

Open http://127.0.0.1:5178. This explicitly synthetic demo makes no AI calls.
Send messages and interact with the DIL checklist.

To use OpenAI, copy `examples/vite-node/.env.example` to
`examples/vite-node/.env`, configure the key, model and application session token,
then run `npm run dev:chat`. The OpenAI key stays on the server. Enter only the
application session token in the browser. Generation and translation consume
your OpenAI account budget.

Try `npm run dev:profiles` for a [custom grammar example](examples/profiles/README.md).

## Use the packages

Install the beta frontend packages:

```sh
npm install @intlui/react@beta @intlui/client@beta
```

For the backend:

```sh
npm install @intlui/server@beta
```

All four published packages are released as `0.2.0-beta.1`.
For application-owned surfaces and components,
see [extension registration and migration](EXTENSIONS.md). Use explicit versions for
reproducible installs. To build local archives instead:

```sh
npm run pack:packages
```

Install all four archives from `dist/packages` in your project with
`npm install <paths-to-the-four-archives>`.

- [Server and OpenAI](packages/server/README.md): routes, authentication, storage and limits.
- [React + Vite + Node](examples/vite-node/README.md): a complete same-origin example.
- [Next.js](examples/next-chat/README.md): App Router and `/api/chat`.
- [React hook](packages/react/README.md): sending, streaming, cancellation and reset.
- [Advanced components](examples/advanced/README.md): forms, SVG, scatter plots,
  files, timers, media, dragging, WebGL, maps and local data.

## Development

Read [CONTRIBUTING.md](CONTRIBUTING.md), [VERSIONING.md](VERSIONING.md) and
[TESTING.md](TESTING.md). Source, documentation and built-in interface text are English.

```sh
npm run check
npm test
npm run build:chat
npm run audit:consumer
```

Tests use simulated providers and never call paid models. The consumer audit
installs archived packages in an external project and verifies standalone chat
and a Vite build. Images and references require an application resolver; maps
and JSON sources use same-origin resources. LaTeX rendering is not included.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
Dependencies retain their own licenses.
