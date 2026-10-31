import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnState, reduceEvent} from '../src/index.js';

const scope = {projectId: 'test', conversationId: 'conversation', turnId: 'turn'};
const capabilities = {surface: 'react', formats: ['dil'], components: ['text']};
const event = (state, type, payload) => ({version: '0.1', ...scope, sequence: state.sequence + 1, turnRevision: state.turnRevision, type, ...payload});
const block = (id, chars = 40000) => ({id, format: 'dil', revision: 1, source: '<text>Fixture</text>', requiredComponents: ['text'], appData: {text: 'x'.repeat(chars)}});

test('text/status/error/terminal progress retains immutable UI without serializing it again', t => {
  let state = createTurnState(scope, capabilities);
  state = reduceEvent(state, event(state, 'ui.create', {block: block('first')}));
  Object.freeze(state.blocks[0].appData); Object.freeze(state.blocks[0]); Object.freeze(state.blocks); Object.freeze(state);
  const blocks = state.blocks, original = state, stringify = JSON.stringify;
  let uiSerializations = 0;
  t.mock.method(JSON, 'stringify', function(value, ...args) {
    if (value === blocks) uiSerializations++;
    return stringify.call(this, value, ...args);
  });
  for (let index = 0; index < 2000; index++) state = reduceEvent(state, event(state, 'text.delta', {text: 'word '}));
  state = reduceEvent(state, event(state, 'status', {status: 'translating'}));
  state = reduceEvent(state, event(state, 'error', {code: 'translation_failed', message: 'Fixture error'}));
  state = reduceEvent(state, event(state, 'turn.end', {status: 'partial', reason: 'translation_failed'}));
  assert.equal(uiSerializations, 0); assert.equal(state.blocks, blocks);
  assert.equal(state.text, 'word '.repeat(2000)); assert.equal(original.text, ''); assert.equal(original.sequence, 1);
  assert.equal(state.status, 'partial'); assert.equal(state.terminal, true);
});

test('aggregate UI limit still applies to create and data changes; removal and reset free capacity', () => {
  let state = createTurnState(scope, capabilities);
  for (let index = 0; index < 4; index++) state = reduceEvent(state, event(state, 'ui.create', {block: block(`block-${index}`)}));
  const retained = state;
  assert.throws(() => reduceEvent(state, event(state, 'ui.create', {block: block('overflow')})), /Turn UI size limit/);
  assert.equal(state, retained); assert.equal(state.blocks.length, 4);
  for (let index = 0; index < 2; index++) state = reduceEvent(state, event(state, 'ui.data', {id: `block-${index}`, revision: 2, appData: {text: 'y'.repeat(59000)}}));
  const beforeFailure = state;
  assert.throws(() => reduceEvent(state, event(state, 'ui.data', {id: 'block-2', revision: 2, appData: {text: 'y'.repeat(59000)}})), /Turn UI size limit/);
  assert.equal(state, beforeFailure); assert.equal(state.blocks[2].revision, 1);
  state = reduceEvent(state, event(state, 'ui.remove', {id: 'block-0'}));
  state = reduceEvent(state, event(state, 'ui.create', {block: block('replacement')}));
  assert.equal(state.blocks.length, 4);
  state = reduceEvent(state, event(state, 'turn.reset', {turnRevision: 1, text: 'Corrected'}));
  assert.equal(state.blocks.length, 0);
  state = reduceEvent(state, event(state, 'ui.create', {block: block('replacement')}));
  assert.equal(state.blocks.length, 1); assert.equal(state.turnRevision, 1);
});
