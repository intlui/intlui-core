import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSandboxMessage} from '../src/sandbox-message.js';
import {createSandboxSession} from '../src/sandbox-session.js';
import {createRuntime} from '../src/runtime.js';
import {compileDil} from '../src/compiler.js';

test('actual runtime snapshots and callback identifiers pass host validation', () => {
  const messages = [];
  const runtime = createRuntime(message => messages.push({...message, sequence: 1}));
  runtime.load(compileDil('{@body const [done,setDone]=DIL.useState(false)}\n<checkbox checked={done} onChange={setDone}>Task</checkbox>').payload);
  assert.equal(messages[0].type, 'snapshot');
  for (const message of messages) assert.doesNotThrow(() => validateSandboxMessage(message, 1));
  runtime.dispose();
});

test('host rejects malformed, cyclic, oversized and future-sequence worker data', () => {
  const cyclic = {}; cyclic.self = cyclic;
  const snapshot = tree => ({type: 'snapshot', sequence: 1, tree});
  let deep = 'end'; for (let i = 0; i < 82; i++) deep = [deep];
  const messages = [null, [], {type: 'unknown'}, {type: 'ack', sequence: 2}, {type: 'ack', sequence: NaN},
    snapshot(cyclic), snapshot({type: 'text', props: new Map()}), snapshot({type: {nested: 'invalid'}}),
    snapshot('x'.repeat(1000001)), snapshot(Array(12001).fill('item')), snapshot(deep),
    {...snapshot('valid'), diagnostics: [{message: 'not a string'}]}, {type: 'error', sequence: 1, message: {unsafe: true}}];
  for (const message of messages) assert.throws(() => validateSandboxMessage(message, 1), /Invalid sandbox/);
});

test('invalid worker message closes transport, clears controls and cannot revive after failure', () => {
  const views = []; let closed = 0;
  const port = {postMessage() {}, close() {closed++;}, onmessage: null};
  const session = createSandboxSession({port, getInitialLoad: () => ({artifact: {code: ''}}), onView: view => views.push(view), onClose() {}});
  const receive = port.onmessage;
  try {
    receive({data: {type: 'ready'}});
    receive({data: {type: 'snapshot', sequence: 1, tree: {type: 'button'}}});
    assert.equal(views.at(-1).tree.type, 'button');
    assert.doesNotThrow(() => receive({data: null}));
    assert.equal(closed, 1); assert.equal(views.at(-1).tree, null);
    assert.match(views.at(-1).error, /Invalid/);
    const count = views.length;
    receive({data: {type: 'snapshot', sequence: 1, tree: 'late'}});
    assert.equal(views.length, count);
  } finally {session.dispose();}
});
