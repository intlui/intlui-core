# Next.js chat

App Router, a React client component and a Node `/api/chat` route. All chat
components are provided by the public packages.

1. Run `npm run pack:packages` from the core root.
2. Copy this directory to an external project, excluding `.env`, `.next` and `node_modules`.
3. Install the four generated archives with `npm install <paths-to-the-four-archives>`.
   The example manifest includes Next.js 16 and React 19.
4. Copy `.env.example` to `.env.local`.
5. Set `INTLUI_DEMO=1` for a synthetic demo. For OpenAI, set `INTLUI_DEMO=0`,
   the key, model and a random `CHAT_SESSION_TOKEN` of at least 24 characters.
   Set `CHAT_ORIGIN` to the exact browser origin, such as `http://localhost:3000`
   or your public HTTPS origin (no path or trailing slash). Next may expose an
   internal URL to the route; this explicit allowlist preserves origin checks.
6. Run `npm run dev` and open http://127.0.0.1:3000.

Enter the application token in the chat; keep the OpenAI key in `.env.local`.
Replace static authentication with your own login. The compiler uses Node and
the route declares `runtime = 'nodejs'`.

Keep `@intlui/react` bundled by Next; do not add it to `serverExternalPackages`.
Its hooks must share Next's React instance during server rendering. The example
externalizes only the Node server engine.

Use `npm run build` and `npm start` to verify the framework build and running app.
The [automated release verification](https://github.com/intlui/intlui-core/actions/runs/41223935913)
passed fresh external installation, TypeScript, production build and browser
interaction on 2026-10-31. The browser test exercises synthetic streaming,
interactive state, conversation history, cancellation and reset. The route also
has regression tests for configured public origins and authentication.

Default storage is instance-local. Use a shared store for serverless or multiple
instances; module variables do not provide persistent history.
See the [server contract](../../packages/server/README.md).
