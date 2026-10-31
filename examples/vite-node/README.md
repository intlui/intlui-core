# React, Vite and Node chat

Complete example with an `/api/chat` route, application authentication, React hook
and DIL renderer. It uses only the four public packages.

## From this repository

```sh
npm ci
npm run dev:chat:demo
```

Open http://127.0.0.1:5178. The demo generates synthetic responses and a checklist
without OpenAI. Each demo session uses a random in-memory identifier.

For OpenAI, copy this directory's `.env.example` to `.env` and set:

- `INTLUI_DEMO=0`
- `OPENAI_API_KEY`: your server-only key.
- `OPENAI_MODEL`: a model enabled for your account.
- `OPENAI_TRANSLATION_MODEL`: optional; otherwise uses the same model.
- `CHAT_SESSION_TOKEN`: a random value of at least 24 characters for this example.
  Do not use the OpenAI key as the application session token.

Run `npm run dev:chat` from the repository root. Enter the application token in
the browser. No paid request starts until you submit a message.

## Standalone project

1. Run `npm run pack:packages` from the core root.
2. Copy this directory into a new project, excluding `dist`, `.env` and `node_modules`.
3. Install the four archives from `dist/packages` with
   `npm install <paths-to-the-four-archives>`. The React/Vite dependencies in the
   example manifest are installed as well.
4. Run `npm run dev:demo`, or configure `.env` and run `npm run dev`.

`npm run build` produces frontend assets. `server.mjs` is a Vite development
server; for deployment mount the handler in your backend and serve assets through
your hosting. Keep the route same-origin or configure CORS explicitly.

The static token is for a single-user example. Replace `authenticate` in
`chat-server.mjs` with your login and connect persistent storage where needed.
See the [server contracts](../../packages/server/README.md).
