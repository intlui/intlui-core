# @intlui/server

## Custom language profiles

`createChatHandler` accepts `profiles: [createUiProfile(), customAdapter]`.
Omitting this option enables UI only. An adapter contains:

- `profile: {id, version}` and server-owned translation `instructions`.
- `compile(source, {signal})`, returning `{artifact, requiredComponents}`.
- `validateData(artifact, data, {signal, previousAppData})`; throw or return
  `false` to reject creation or a data revision. Both methods may be asynchronous.

Compilation artifacts stay on the server. UI data uses protocol JSON limits;
custom schemas belong to the adapter. Every emitted block must satisfy negotiated
components and profile identity. Register trusted modules in application code;
neither requests nor model output can name modules or replace adapter instructions.
Unknown ID/version pairs return `unsupported_profile` before provider calls.

Optional `authorizeProfile({identity, profile, request})` must return `true` to
admit the selected profile; otherwise the handler returns `profile_denied`.
Stored turns include their profile. Cross-profile history is rejected with
`conversation_profile_mismatch`; start a new conversation to change profiles.
Stores must preserve this field. Legacy records without it mean UI version 0.1.

Protocol 0.1 requests can use implicit UI or select exactly one
profile in capabilities and receive profile-tagged blocks. No discovery endpoint
or automatic fallback is provided. Source generation instructions remain separate
from the selected adapter's translation instructions.


A standalone chat server for text and DIL. Use your OpenAI key, validate UI
operations and stream progressive events to React.

```js
import {createChatHandler, createOpenAiProvider} from '@intlui/server';

const provider = createOpenAiProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
  translationModel: process.env.OPENAI_TRANSLATION_MODEL || process.env.OPENAI_MODEL,
  instructions: 'Use the supplied facts, preserving qualifications and limitations.'
});

export const POST = createChatHandler({
  provider,
  authenticate: async request => {
    const session = await verifyYourSession(request);
    return session ? {userId: session.userId} : null;
  }
});
```

`verifyYourSession` represents your application login; the package does not impose
an account system. Invalid sessions receive `401`. Identity, keys and models are
not accepted from the browser JSON body.

In Next.js, export the handler from `app/api/chat/route.js` and set
`export const runtime = 'nodejs'`. With Node HTTP:

```js
import {createServer} from 'node:http';
import {toNodeHandler} from '@intlui/server/node';
createServer(toNodeHandler(POST, {origin:'http://127.0.0.1:3000'}))
  .listen(3000, '127.0.0.1');
```

The adapter uses a server-configured origin. In Express, mount it before
middleware that consumes the body. Other page routing belongs to the application.

## Conversations and storage

The client sends only `previousTurnId`. The server retrieves messages and responses
from its user-scoped store; arbitrary browser-supplied history is not accepted.
Continue from the last completed generation turn.

Default storage is temporary and process-local: at most 1,000 request receipts,
1,000 turns, 8 MiB of content and one hour of retention. Duplicates are rejected
within that window, without automatic retries. These bounds do not guarantee
deduplication after restart or expiry.

Supply a `store` with these asynchronous methods:

| Method | Contract |
| --- | --- |
| `claim(userId, requestId)` | Atomic admission; `false` if already used |
| `get(userId, turnId)` | That user's turn or `null` |
| `save(userId, turn)` | Save text, context, profile and turn status |

For multiple instances or serverless deployments, connect a shared database with
isolation, atomic deduplication and retention. Handler concurrency limits are
process-local; distributed quotas and periodic revocation checks belong to the
application. Never store provider keys in conversations.

## Streaming, limits and costs

`generate` produces text through the Responses API and translates it into DIL
during the response. `translate` makes supplied text interactive. Each translation
may make another model call; a turn is not limited to one OpenAI call. Original
text remains available if UI translation fails.

Configure `limits`: `maxTranslations` (24), `flushMs` (700), `initialFlushMs`
(2800), `initialBatchChars` (256), `maxBatch` (6000), `maxOutputChars` (30000),
`maxInputChars` (4096), `maxBodyBytes` (131072), `timeoutMs` (120000),
`maxConcurrentPerUser` (2), `maxConcurrent` (100), `maxHistoryTurns` (8),
`maxHistoryChars` (64000) and `intervalMs` (1, for supplied text).
Values are positive integers. The renderer advertises supported components.

`onUsage({userId, turnId, usage})` receives provider-reported usage, not a bill.
The provider also accepts `model`, `translationModel`, `maxOutputTokens` and
`timeoutMs`. The base DIL prompt is included in the package.

HTTP responses use NDJSON conforming to `@intlui/protocol`. Client closure and
timeouts propagate cancellation; custom providers must honor `signal`.
Streaming applies backpressure. Avoid HTTP buffering in proxies.

The standalone route supports `generate` and `translate`. Incremental
`translate-stream` input endpoints, replay and platform administration are not
part of this route. `@intlui/server/pipeline` can receive a `sourceStream` in
a custom integration.

Browser requests are same-origin by default. `allowedOrigins` adds accepted
origins; the host supplies CORS headers and preflight handling. For cookie sessions,
integrate the CSRF protection required by your authentication system.

## Examples

- [Vite and Node](../../examples/vite-node/README.md)
- [Next.js](../../examples/next-chat/README.md)

No IntlUI service is required. API keys stay on the server.
