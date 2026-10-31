# @intlui/client

Part of the Apache-2.0 IntlUI Core repository. Run npm test in the core root for the client unit and HTTP transport tests.

## Subscribe to an existing Realtime transport

`subscribeOpenAIRealtimeSource` binds the decoder to an already-open WebSocket or
RTCDataChannel with EventTarget methods. It subscribes immediately, allowing bounded
buffering before the IntlUI request starts. Only JSON string messages are accepted;
the default raw message limit is 1,000,000 UTF-16 units, including ignored events.
This is the Realtime server-event contract, not the separate GPT-Live protocol.

```js
import {subscribeOpenAIRealtimeSource, translateTextStream} from '@intlui/client';

// These bindings come from the host's already authorized Realtime session.
const subscription = subscribeOpenAIRealtimeSource({
  transport: connectedChannel, ...selectedPart, signal: controller.signal,
});
try {
  await translateTextStream({
    ...intluiOptions, signal: controller.signal, source: () => subscription,
  });
} finally {
  subscription.dispose();
}
```

Bind before the first selected transcript delta. `selectedPart` contains responseId,
itemId and optional outputIndex/contentIndex. `intluiOptions` supplies the session
credential, translate-stream request and UI callback. The `finally` is necessary
even if HTTP admission fails or replays without ever requesting the source.

Completion, invalid messages, transport error/close, abort and iterator return
detach only this subscription's listeners. `dispose()` aborts locally and drops
queued text; it never calls transport.close/send, stops microphone tracks or
cancels the remote response. Provider session errors received as JSON remain the
host's responsibility; call `subscription.fail(new Error(...))` for a fatal one.
No session establishment, credentials, audio playback, reconnection or model calls
are performed by this helper. Tests use an in-process EventTarget plus the real
IntlUI HTTP pipeline, not a live WebRTC peer or OpenAI connection.

Transport reference: https://developers.openai.com/api/docs/guides/realtime-webrtc#sending-and-receiving-events

## OpenAI Realtime assistant transcript adapter

`createOpenAIRealtimeSource({responseId, itemId, outputIndex: 0, contentIndex: 0,
signal})` is an async text iterable for one explicitly selected assistant audio
content part. Feed already-decoded server events with `push(event)`. It streams
`response.output_audio_transcript.delta` immediately, checks the final transcript
against the accumulated text and waits for a successful `response.done` with the
matching output item/content before ending. Transcript-done alone is not success:
OpenAI emits it for interrupted responses too. Failed/cancelled/incomplete status,
missing events, mismatched final text and conflicting duplicate IDs fail the source.

Other responses, content parts, raw audio and unrelated events return false.
Exact duplicate selected event IDs are ignored. Defaults: 30,000 total UTF-16
characters, 4,096 remembered events, and the standard text queue limits.
The source retains only bounded transcript/deduplication data and clears it on
termination. `push` after closure throws. One source represents one part; create
separate scoped sources for additional output parts rather than concatenating them
implicitly. Attach before the first delta; late subscription cannot recover a
complete transcript silently. Ordered delivery is required, not reconnection.

Use it as the source for `translateTextStream`. The host owns WebSocket/WebRTC,
authorization and subscription lifecycle, must detach listeners when closed or
aborted, call `fail(error)` on fatal session/transport errors, and call `end()` on
transport closure (which rejects unless successful completion was already seen).
Session-level `error` events are not automatically routed to a selected response.
This adapter creates no session, sends no audio, and cancels no remote response.
Local translation cancellation does not stop upstream audio or billing; the host
must separately cancel its authorized Realtime response when appropriate.

Generated transcript timing is not audio playback timing. The feature does not
yet align UI with what the listener has actually heard. No live provider validation
is claimed; fixtures test the documented event shape and the local HTTP pipeline.

Official contract checked 25 October 2026:
- https://developers.openai.com/api/reference/resources/realtime/server-events#response.output_audio_transcript.delta
- https://developers.openai.com/api/reference/resources/realtime/server-events#response.output_audio_transcript.done
- https://developers.openai.com/api/reference/resources/realtime/server-events#response.done

## Finalized transcript source

`createTranscriptSource` adapts ordered transcription updates to the async text
source accepted by `translateTextStream`. It does not acquire audio or connect to
a speech provider. Normalize provider events to `{sequence, text, final}` first.

```js
const transcript = createTranscriptSource({signal});
transcript.push({sequence: 1, text: 'five items', final: false});
transcript.push({sequence: 1, text: 'four items', final: true});
// The finalized sentence is already available to the translator here.
transcript.push({sequence: 2, text: 'Delivery tomorrow.', final: true});
transcript.end();
```

Sequence starts at 1 and increases after each final event. Interim text replaces
`pendingText` locally; only final text enters the stream. Nonempty utterances are
joined with a newline by default (`separator` is configurable, at most 16 UTF-16
units). Finalizing with empty text explicitly discards a provisional utterance.
`end()` rejects an unfinished provisional utterance rather than silently accepting
or dropping it. Exact replay of the last finalized event is ignored, including
while the next interim is pending. Older events, sequence gaps and conflicting
finals fail the stream. Final text cannot be revised after delivery.

Default segment limit is 4,096 UTF-16 units; queued final text uses the same
character/chunk limits as createTextSource. Abort and iterator return clear
provisional state; errors drain previously accepted text before failing. Events
must be ordered by the host adapter. This is not provider-specific diarization,
audio playback alignment or a reconnect/resume protocol.

Public npm package for browser/Node 22 applications, supporting IntlUI protocols
0.1 and 0.2 with no React dependency and no model provider keys.
Install the beta with `npm install @intlui/client@beta`. See the repository
[extension guide](../../EXTENSIONS.md) for explicit protocol 0.2 selection.

```js
import { startTurn } from '@intlui/client';

const abort = new AbortController();
const state = await startTurn({
  apiBaseUrl: 'https://your-intlui-api.example',
  token: session.token, // short-lived IntlUI session credential
  projectId: session.projectId,
  signal: abort.signal,
  request: {
    version: '0.1',
    requestId: crypto.randomUUID(),
    intent: 'Preserve all facts',
    input: { mode: 'generate', text: 'Explain the available plans' },
    capabilities: { surface: 'text', formats: [], components: [] }
  },
  onState: next => renderAnswer(next)
});
```

For React UI, declare `surface: 'react'`, `formats: ['dil']` and the component
names your renderer actually supports. Pass each state to `IntluiAnswer` from
`@intlui/react`. Text-only capability negotiation requests no UI blocks.
The API origin must permit the host origin and authorize the supplied session.
An empty API base uses the browser's same origin; Node needs an absolute origin.

The request is snapshotted and validated before sending. The session token is
sent only in the Authorization header. `projectId` rejects a foreign-project
stream before any state callback; it is an additional client check, not server
authorization. Scope, sequence, revision and capabilities are validated for each
event. `onState` is optional. `fetchImpl` supports custom transport and tests.

`startTurn` resolves on any valid terminal event: inspect `state.status` to
distinguish complete, partial, failed and cancelled server outcomes. It rejects
on transport/protocol errors and local abort. Already delivered state remains
with the host; do not discard it on failure. HTTP EOF without a terminal event
is an error. A terminal event releases the reader without waiting for HTTP EOF.

There are no automatic retries or reconnects. A request ID is caller-owned for
explicit idempotent replay; it must not be reused with different contents.
For a follow-up generation, send `previousTurnId` from a completed turn.
Omit it for a new conversation. This package does not store chat history,
credentials, session refresh, admin login, billing or provider configuration.
`readEvents` is also exported as the lower-level validated NDJSON iterator.

Run `npm test --workspace @intlui/client` from the workspace root. Shared
cancellation and parsing regressions also run in the website test suite against
both the website and widget wrappers. No tests call paid models.


## Independent installation audit

Run `npm run audit:consumer` from the core root. It installs all four package archives in an external temporary project and checks a standalone simulated chat, React primitives and a Vite build. It uses cached/local dependencies; registry downloading, TypeScript and browser compatibility are not verified by this command. Logs stay in the system temporary directory. See the repository STATUS.md for remaining checks.

## Incremental producer input

HTTP rejections from `startTurn` and `appendInput` throw `IntluiHttpError` with
`status` and an allowlisted API `code` (`http_error` when unknown). Hosts can
distinguish `turn_quota`, `session_turn_quota` and `concurrency_limit` without
parsing localized messages. Arbitrary response messages are never exposed.
Error bodies are limited to 8 KiB and a one-second read deadline; cancellation
still propagates as an abort. Network, protocol and source errors remain ordinary
errors. No rejection is retried automatically.

Servers advertising `translate-stream` accept an initially empty source through
`startTurn`, followed by numbered chunks using `appendInput`. Import both from
`@intlui/client`. The first state callback supplies the turn ID while the output
stream stays active. Each input frame is `{sequence, text, end}`; sequences start
at 1 and the last frame sets `end: true`. Await each acknowledgement before
sending the next chunk. Use the same session credential for both operations.

`appendInput` returns `{turnId, replayed, nextSequence}` and rejects HTTP failures
with an error containing `status`. It performs no retries or buffering. On 429,
the frame was not accepted and the same sequence can be retried later. The
latest exact accepted frame is idempotent; older frames are not replayable.
Respect the server's frame, total-character and idle limits. Abort the output
request if your producer fails so the server can release the active turn.
See the API README for the complete input endpoint and lifecycle contract.


### Connect an asynchronous text source

`translateTextStream` manages the producer and output concurrently:

```js
import { translateTextStream } from '@intlui/client';

const result = await translateTextStream({
  apiBaseUrl, token, projectId,
  signal: abortController.signal,
  request: {
    version: '0.1', requestId: crypto.randomUUID(), intent: 'Present facts',
    input: { mode: 'translate-stream', text: '' }, capabilities
  },
  source: ({signal}) => externalTextSource({signal}),
  onState: renderAnswer
});
```

Your `externalTextSource` returns an async iterable of strings and must honor the
supplied signal to release upstream resources. Source chunks are split into
frames of at most `chunkChars` UTF-16 characters (default 1024, range 2..4096),
without splitting a surrogate pair within a chunk. Small source chunks are coalesced until that size or `flushMs` (default 100 ms,
range 0..2000). The deadline belongs to the oldest buffered text, so a continuing
source cannot keep postponing it. Set flushMs to 0 to send small chunks immediately.
An acknowledgement already in flight still applies backpressure; these settings
are batching limits, not an end-to-end latency guarantee. Choose chunkChars within the project's advertised frame limit.

The helper numbers frames, awaits each acknowledgement, sends the final marker
and reads the UI output concurrently. Source failure aborts the active output;
server termination cancels the source. A stalled next()/return() cannot block
local cancellation, but a source ignoring signals can retain its own resources.
Terminal replay does not restart the source. No frame retries are automatic:
network failures and 429 abort this operation rather than silently duplicating
source work. Return status still distinguishes complete, partial and failed.

### Bridge event-based producers

`createTextSource({signal, maxBufferedChars: 30000, maxBufferedChunks: 1024})`
adapts push callbacks to a single-consumer async iterable. Use it inside the
`source` factory so a replay does not open an unnecessary upstream connection:

```js
import {createTextSource, translateTextStream} from '@intlui/client';

await translateTextStream({
  ...turnOptions,
  source: async function* ({signal}) {
    signal.throwIfAborted();
    const text = createTextSource({signal});
    // subscribeToText is your provider-specific adapter, returning cleanup.
    const unsubscribe = subscribeToText({
      signal,
      onDelta(delta) {try {text.push(delta);} catch (error) {text.fail(error);}},
      onComplete() {text.end();},
      onError(error) {text.fail(error);},
    });
    try {yield* text;} finally {unsubscribe();}
  },
});
```

`push` accepts strings only. Overflow throws to the producer and fails the
consumer after accepted queued text drains; it never drops a fragment and then
reports successful completion. `end` drains queued text normally; `fail(Error)`
drains it then rejects. Abort or iterator `return()` discards queued text and
unblocks reads. `bufferedChars` reports queued UTF-16 characters, excluding text
already pulled by batching or HTTP transport. These limits do not replace the
API's total-turn limit. Producers should stop their upstream work on failure.

Feed only new appended text, not repeated cumulative transcripts. Revisions to
earlier transcript text need a separate correction strategy and are not handled
by this adapter. It does not implement a voice provider, audio transport, speech
timing or audio/UI synchronization.

Temporary replay retention
--------------------------
The local API can reclaim completed conversations under memory pressure. A retry
with the same request ID then throws `IntluiHttpError` with status 410 and code
`replay_expired`; it does not run the provider again. Do not automatically replace
the request ID to bypass this response. A fresh request is a deliberate new turn
and may consume quota. A removed conversation parent returns 404
`conversation_not_found`. Request receipts are in memory and disappear on API
restart. Durable counters do not imply durable conversation or replay storage.
