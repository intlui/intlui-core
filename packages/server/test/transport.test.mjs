import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonStream, responseText } from '../src/stream-transport.js';
import { createOpenAiProvider } from '../src/provider.js';

test('SSE decoder preserves split UTF-8, CRLF, multiline data and rejects huge frames', async () => {
  const bytes = new TextEncoder().encode('event: delta\r\ndata: {"type":"delta",\r\ndata: "text":"coffee ☕"}\r\n\r\ndata: [DONE]\r\n\r\n');
  async function* split() { for (const byte of bytes) yield Uint8Array.of(byte); }
  assert.deepEqual(await Array.fromAsync(readJsonStream(split(), 'sse')), [{ type: 'delta', text: 'coffee ☕' }]);
  async function* huge() { yield new TextEncoder().encode('x'.repeat(250001)); }
  await assert.rejects(Array.fromAsync(readJsonStream(huge(), 'sse')), /too large/);
});

test('Responses transport requires completion and never forwards upstream secret body', async () => {
  const fetchImpl = async () => new Response('data: {"type":"response.output_text.delta","delta":"Hello"}\n\n');
  await assert.rejects(Array.fromAsync(responseText({ apiKey: 'fixture-key', model: 'fixture-model', fetchImpl })), /before.*completion/);
  await assert.rejects(Array.fromAsync(responseText({ apiKey: 'fixture-key', model: 'fixture-model', fetchImpl: async () => new Response('secret-provider-body', { status: 401 }) })), error => !error.message.includes('secret-provider-body'));
});

test('real provider requires explicit key/model and bounds configuration', () => {
  assert.throws(() => createOpenAiProvider(), /KEY/);
  assert.throws(() => createOpenAiProvider({ apiKey: 'fixture' }), /model/);
  assert.throws(() => createOpenAiProvider({ apiKey: 'fixture', model: 'fixture', timeoutMs: 0 }), /limits/);
});

test('malformed or truncated UTF-8 is rejected instead of silently replacing source characters', async () => {
  for (const format of ['sse', 'ndjson']) {
    const prefix = new TextEncoder().encode((format === 'sse' ? 'data: ' : '') + '{"text":"');
    for (const suffix of [Uint8Array.of(0xff, 0x22, 0x7d, 10, 10), Uint8Array.of(0xe2, 0x82)]) {
      async function* bytes() {yield prefix; for (const byte of suffix) yield Uint8Array.of(byte);}
      await assert.rejects(Array.fromAsync(readJsonStream(bytes(), format)), TypeError);
    }
  }
});

test('Responses completion releases an open HTTP stream without waiting for EOF or a slow cancel hook', {timeout: 2000}, async () => {
  let cancelled = 0;
  const body = new ReadableStream({start(controller) {
    controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"Hello"}\n\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":2}}}\n\n'));
  }, cancel() {cancelled++; return new Promise(() => {});}});
  const observed = [];
  const values = await Array.fromAsync(responseText({apiKey: 'fixture', model: 'fixture', fetchImpl: async () => new Response(body), onEvent: event => observed.push(event)}));
  assert.deepEqual(values, ['Hello']);
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
  assert.deepEqual(observed.at(-1), {stage: 'completed', usage: {input_tokens: 1, output_tokens: 2}});
});

test('Responses abort releases a stalled reader even when the fetch implementation ignores its signal', {timeout: 2000}, async () => {
  let cancelled = 0;
  const body = new ReadableStream({cancel() {cancelled++;}});
  const controller = new AbortController();
  const result = Array.fromAsync(responseText({apiKey: 'fixture', model: 'fixture', signal: controller.signal, fetchImpl: async () => new Response(body)}));
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(result, {name: 'AbortError'});
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
});
