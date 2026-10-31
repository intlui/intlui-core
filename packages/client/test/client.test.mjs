import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startTurn, appendInput } from '@intlui/client';
const fixture = JSON.parse(await readFile(new URL('../../protocol/fixtures/progressive.json', import.meta.url), 'utf8'));
const request = { version: '0.1', requestId: 'external-request', input: { mode: 'translate', text: 'Facts' }, intent: 'Checklist', capabilities: { surface: 'react', formats: ['dil'], components: ['text', 'checkbox'] } };
const response = (events = fixture.events) => new Response(events.map(event => JSON.stringify(event)).join('\n'));

test('profile requests reject unknown wire versions before delivering state', async () => {
  const explicit = {...request,version:'0.1',capabilities:{...request.capabilities,profile:{id:'example.counter',version:'0.1'}}};
  let delivered=0;
  await assert.rejects(startTurn({endpoint:'/chat',request:explicit,onState(){delivered++;},fetchImpl:async()=>response(fixture.events.map(event=>({...event,version:'0.2'})))}), /version/i);
  assert.equal(delivered,0);
});

test('external client consumes a turn with explicit capabilities, session token and request identity', async () => {
  let sent;
  const states = [];
  const state = await startTurn({ apiBaseUrl: 'https://api.example/', token: 'session-secret', request, projectId: fixture.events[0].projectId,
    onState: value => states.push(value), fetchImpl: async (url, init) => { sent = { url, ...init }; return response(); } });
  assert.equal(state.terminal, true);
  assert.equal(state.text, 'Verify data. Verify controls.');
  assert.equal(sent.url, 'https://api.example/v1/turns');
  assert.equal(sent.headers.Authorization, 'Bearer session-secret');
  assert.deepEqual(JSON.parse(sent.body), request);
  assert(!sent.body.includes('session-secret'));
  assert.equal(states.length, fixture.events.length);
});

test('invalid capability requests and credential-bearing origins fail before fetch', async () => {
  let calls = 0;
  const options = { token: 'session', request, fetchImpl: async () => { calls++; return response(); } };
  await assert.rejects(startTurn({ ...options, request: { ...request, history: [] } }), TypeError);
  for (const apiBaseUrl of ['https://user:secret@example.com', 'https://example.com/private', 'file:///tmp']) {
    await assert.rejects(startTurn({ ...options, apiBaseUrl }), TypeError);
  }
  assert.equal(calls, 0);
});

test('foreign project events never reach the callback; failed requests are never retried', async () => {
  let calls = 0, delivered = 0;
  await assert.rejects(startTurn({ token: 'session', request, projectId: 'foreign', onState() { delivered++; }, fetchImpl: async () => response() }), /Unexpected project/);
  assert.equal(delivered, 0);
  await assert.rejects(startTurn({ token: 'session', request, fetchImpl: async () => { calls++; return new Response('', { status: 429 }); } }));
  assert.equal(calls, 1);
});


test('input helper rejects invalid frames before fetch and validates acknowledgements without retry', async () => {
  let calls = 0;
  const options = { token: 'session', turnId: 'turn-1', frame: {sequence: 1, text: 'Facts', end: false},
    fetchImpl: async () => { calls++; return Response.json({turnId: 'foreign', nextSequence: 2, replayed: false}); } };
  await assert.rejects(appendInput({...options, frame: {...options.frame, sequence: 0}}), TypeError);
  assert.equal(calls, 0);
  await assert.rejects(appendInput(options), /acknowledgement/);
  assert.equal(calls, 1);
  await assert.rejects(appendInput({...options, fetchImpl: async () => new Response('', {status: 429})}), {status: 429});
});
