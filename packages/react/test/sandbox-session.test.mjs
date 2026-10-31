import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxSession } from '../src/sandbox-session.js';

function harness(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sent = [], views = [];
  let closes = 0, portCloses = 0, data = { revision: 1 };
  const port = { onmessage: null, postMessage: message => sent.push(message), close: () => { portCloses++; } };
  const session = createSandboxSession({ port, timeoutMs: 40, startupTimeoutMs: 100,
    getInitialLoad: () => ({ artifact: { code: 'fixture', appData: data }, environment: { theme: 'dark' } }),
    onView: view => views.push(view), onClose: () => { closes++; } });
  const receive = port.onmessage;
  t.after(() => session.dispose());
  return { session, port, sent, views, receive: data => receive({ data }),
    updateInitial: value => { data = value; }, counts: () => [closes, portCloses] };
}

test('handshake loads newest data once, acknowledges independent commands and disposes without a false error', t => {
  const h = harness(t);
  assert.equal(h.session.post({ type: 'data' }), undefined);
  h.updateInitial({ revision: 2 });
  h.receive({ type: 'ready' }); h.receive({ type: 'ready' });
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.sent[0].artifact.appData, { revision: 2 });
  assert.equal(h.sent[0].environment.theme, 'dark');
  const second = h.session.post({ type: 'data', appData: { revision: 3 } });
  h.receive({ type: 'ack', sequence: second });
  h.receive({ type: 'ack', sequence: 1 });
  t.mock.timers.tick(150);
  assert.deepEqual(h.counts(), [0, 0]);
  h.session.post({ type: 'trigger', id: 8 });
  h.session.dispose(); h.session.dispose();
  t.mock.timers.tick(150);
  h.receive({ type: 'snapshot', tree: { type: 'button' } });
  assert.deepEqual(h.counts(), [1, 1]);
  assert.deepEqual(h.views, []);
});

test('recoverable runtime errors remove stale controls and allow later valid snapshots', t => {
  const h = harness(t);
  h.receive({ type: 'ready' }); h.receive({ type: 'ack', sequence: 1 });
  h.receive({ type: 'snapshot', sequence: 1, tree: { type: 'button' }, diagnostics: ['old warning'] });
  h.receive({ type: 'error', sequence: 1, message: 'Invalid chart data' });
  assert.deepEqual(h.views.at(-1), { tree: null, diagnostics: [], sequence: 1, error: 'Invalid chart data', loading: false });
  assert.deepEqual(h.counts(), [0, 0]);
  const id = h.session.post({ type: 'data', appData: { valid: true } });
  h.receive({ type: 'snapshot', sequence: id, tree: { type: 'checkbox' } });
  h.receive({ type: 'ack', sequence: id });
  assert.equal(h.views.at(-1).tree.type, 'checkbox');
  assert.equal(h.views.at(-1).error, null);
});

test('unacknowledged command expires even when another command is acknowledged; late replies cannot revive UI', t => {
  const h = harness(t);
  h.receive({ type: 'ready' });
  h.receive({ type: 'snapshot', sequence: 1, tree: { type: 'button' } });
  const second = h.session.post({ type: 'trigger', id: 7 });
  h.receive({ type: 'ack', sequence: second });
  t.mock.timers.tick(41);
  assert.equal(h.views.at(-1).tree, null);
  assert.match(h.views.at(-1).error, /time limit/);
  assert.deepEqual(h.counts(), [1, 1]);
  const count = h.views.length;
  h.receive({ type: 'snapshot', sequence: 1, tree: { type: 'button' } });
  h.receive({ type: 'ready' });
  assert.equal(h.session.post({ type: 'data' }), undefined);
  assert.equal(h.views.length, count);
});

test('startup timeout and fatal worker errors close the transport once and clear the visible tree', t => {
  const h = harness(t);
  t.mock.timers.tick(101);
  assert.match(h.views.at(-1).error, /Sandbox unavailable/);
  h.session.fail('duplicate');
  assert.deepEqual(h.counts(), [1, 1]);
  assert.equal(h.views.length, 1);
});

test('fatal error after rendering removes the tree and ignores further worker messages', t => {
  const h = harness(t);
  h.receive({ type: 'ready' }); h.receive({ type: 'ack', sequence: 1 });
  h.receive({ type: 'snapshot', sequence: 1, tree: { type: 'input' } });
  h.receive({ type: 'fatal', message: 'Worker crashed' });
  h.receive({ type: 'snapshot', sequence: 1, tree: { type: 'input' } });
  assert.deepEqual(h.views.at(-1), { tree: null, diagnostics: [], loading: false, error: 'Worker crashed' });
  assert.deepEqual(h.counts(), [1, 1]);
});

test('structured clone or closed-port send failures become terminal UI errors rather than escaping the event handler', t => {
  const h = harness(t);
  h.port.postMessage = () => { throw new Error('DataCloneError'); };
  assert.doesNotThrow(() => h.receive({ type: 'ready' }));
  assert.match(h.views.at(-1).error, /DataCloneError/);
  assert.equal(h.views.at(-1).tree, null);
  assert.deepEqual(h.counts(), [1, 1]);
  t.mock.timers.tick(150);
  assert.equal(h.views.length, 1);
});
