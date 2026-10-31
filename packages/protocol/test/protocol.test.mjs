import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRequest, validateResolvedContext, validateEvent, validateCapabilities, supportsBlock, createTurnState, reduceEvent } from '../src/index.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/progressive.json', import.meta.url), 'utf8'));
const initial = () => createTurnState(fixture.scope, fixture.request.capabilities);
const event = (sequence, type, payload = {}) => ({ version: '0.1', ...fixture.scope, sequence, turnRevision: 0, type, ...payload });

test('extended capability catalogs remain bounded and reject duplicate names',()=>{
  const components=Array.from({length:128},(_,index)=>`component-${index}`);
  assert.equal(validateCapabilities({surface:'react',formats:['dil'],components}).components.length,128);
  const block={id:'catalog',format:'dil',source:'Catalog',appData:{},revision:1,requiredComponents:components};
  assert(supportsBlock({surface:'react',formats:['dil'],components},block));
  assert.throws(()=>supportsBlock({surface:'react',formats:['dil'],components},{...block,requiredComponents:[...components,'overflow']}),/Invalid requiredComponents/);
  assert.throws(()=>validateCapabilities({surface:'react',formats:['dil'],components:[...components,'overflow']}),/Invalid components/);
  assert.throws(()=>validateCapabilities({surface:'react',formats:['dil'],components:['svg','svg']}),/Invalid components/);
});

test('synthetic progressive fixture preserves source and identity while replacing data', () => {
  validateRequest(fixture.request);
  const states = [initial()];
  for (const item of fixture.events) states.push(reduceEvent(states.at(-1), item));
  assert.equal(states[2].terminal, false);
  assert.equal(states[2].blocks.length, 1);
  assert.equal(states[4].blocks[0].id, states[2].blocks[0].id);
  assert.equal(states[4].blocks[0].source, states[2].blocks[0].source);
  assert.equal(states[2].blocks[0].appData.label, 'Verify data');
  assert.equal(states[4].blocks[0].appData.label, 'Verify data and controls');
  assert.equal(states.at(-1).text, fixture.request.input.text);
  assert.equal(states.at(-1).status, 'complete');
  assert.equal(states.at(-1).terminal, true);
  assert.equal('userState' in states.at(-1), false);
});

test('untrusted requests cannot supply tenant, principal or credentials as contract fields', () => {
  for (const field of ['organizationId', 'projectId', 'principalId', 'apiKey']) {
    assert.throws(() => validateRequest({ ...fixture.request, [field]: 'forged' }), /unknown field/);
  }
  const context = { organizationId: 'org-a', projectId: 'project-demo', principalId: 'verified-session', environment: 'development' };
  assert.equal(validateResolvedContext(context), context);
  assert.throws(() => validateResolvedContext({ ...context, principalId: '' }), /principalId/);
});

test('sequence gaps, duplicates, foreign projects and old revisions fail without mutating state', () => {
  const state = reduceEvent(initial(), fixture.events[0]);
  for (const changed of [
    { ...fixture.events[1], sequence: 1 }, { ...fixture.events[1], sequence: 3 },
    { ...fixture.events[1], projectId: 'project-other' },
    { ...fixture.events[1], turnId: 'turn-other' }, { ...fixture.events[1], turnRevision: 1 }
  ]) assert.throws(() => reduceEvent(state, changed));
  assert.equal(state.sequence, 1);
  assert.equal(state.blocks.length, 0);
});

test('cancellation is terminal and cannot be reopened or updated by late events', () => {
  const state = reduceEvent(initial(), event(1, 'turn.end', { status: 'cancelled', reason: 'user' }));
  assert.throws(() => reduceEvent(state, event(2, 'text.delta', { text: 'late' })), /already ended/);
  assert.throws(() => reduceEvent(state, event(2, 'turn.reset', { turnRevision: 1, text: 'restart' })), /already ended/);
  assert.throws(() => validateEvent(event(1, 'turn.end', { status: 'partial' })), /reason/);
});

test('explicit correction resets server blocks and text, advances revision, rejects old callbacks', () => {
  let state = fixture.events.slice(0, 2).reduce(reduceEvent, initial());
  state = reduceEvent(state, event(3, 'turn.reset', { turnRevision: 1, text: 'Corrected facts.' }));
  assert.equal(state.text, 'Corrected facts.'); assert.equal(state.blocks.length, 0);
  assert.equal(state.turnRevision, 1);
  assert.throws(() => reduceEvent(state, event(4, 'text.delta', { text: 'stale' })), /turn revision/);
  state = reduceEvent(state, event(4, 'text.delta', { turnRevision: 1, text: ' More.' }));
  assert.equal(state.text, 'Corrected facts. More.');
});

test('duplicate IDs, unknown updates and skipped data revisions are rejected', () => {
  const state = fixture.events.slice(0, 2).reduce(reduceEvent, initial());
  assert.throws(() => reduceEvent(state, { ...fixture.events[1], sequence: 3 }), /Duplicate/);
  assert.throws(() => reduceEvent(state, event(3, 'ui.data', { id: 'missing', revision: 2, appData: {} })), /Unknown block/);
  assert.throws(() => reduceEvent(state, event(3, 'ui.data', { id: 'tasks', revision: 3, appData: {} })), /block revision/);
  assert.equal(reduceEvent(state, event(3, 'ui.remove', { id: 'tasks' })).blocks.length, 0);
});

test('legacy text-only surface rejects UI while retaining text fallback', () => {
  const caps = { surface: 'shopify-account', formats: [], components: [] };
  assert.equal(supportsBlock(caps, fixture.events[1].block), false);
  const state = createTurnState(fixture.scope, caps);
  assert.throws(() => reduceEvent(state, { ...fixture.events[1], sequence: 1 }), /Unsupported client capability/);
  assert.equal(reduceEvent(state, event(1, 'text.delta', { text: 'Text fallback' })).text, 'Text fallback');
  assert.throws(() => validateCapabilities({ ...caps, formats: ['dil'], components: ['text'] }, '0.1'), /text-only/);
});

test('provider error is explicit and independent from terminal status', () => {
  let state = reduceEvent(initial(), event(1, 'error', { code: 'provider-unavailable', message: 'Please retry later.' }));
  assert.equal(state.terminal, false);
  state = reduceEvent(state, event(2, 'turn.end', { status: 'failed', reason: 'provider-unavailable' }));
  assert.equal(state.errors.length, 1); assert.equal(state.status, 'failed');
});

test('unknown versions, fields, non-JSON data and excessive content fail validation', () => {
  assert.throws(() => validateRequest({ ...fixture.request, version: '1' }), /version/);
  assert.throws(() => validateEvent(event(1, 'status', { status: 'receiving', token: 'secret' })), /unknown field/);
  for (const appData of [{ n: Infinity }, { fn() {} }, { n: undefined }, JSON.parse('{"__proto__":{}}')]) {
    assert.throws(() => validateEvent(event(1, 'ui.data', { id: 'tasks', revision: 2, appData })));
  }
  assert.throws(() => validateEvent(event(1, 'text.delta', { text: 'a'.repeat(30001) })), /text/);
  assert.throws(() => reduceEvent(reduceEvent(initial(), event(1, 'text.delta', { text: 'a'.repeat(30000) })), event(2, 'text.delta', { text: 'b' })), /text limit/);
});
