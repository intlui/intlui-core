import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCapabilities, validateRequest, createTurnState, reduceEvent} from '../src/index.js';

const caps = {surface:'example.native', formats:['dil'], components:['example.counter'], profile:{id:'example.ui',version:'1'}};
const scope = {projectId:'p', conversationId:'c', turnId:'t'};
const request = {version:'0.2', requestId:'r', intent:'Counter', input:{mode:'translate',text:'Count'}, capabilities:caps};

test('0.2 surfaces are bounded identifiers; rendering is determined by capabilities', () => {
  validateRequest(request);
  for (const surface of ['example.native', 'text', 'future-host']) {
    validateCapabilities({...caps, surface}, '0.2');
    validateCapabilities({surface, formats:[], components:[]}, '0.2');
  }
  for (const surface of ['', 'bad name', '../host', 'x'.repeat(129), null, 4]) assert.throws(() => validateRequest({...request, capabilities:{...caps,surface}}));
  assert.throws(() => validateCapabilities({...caps, formats:[]}), /format/);
  assert.throws(() => validateCapabilities({...caps, formats:['html']}), /format/);
  assert.throws(() => validateCapabilities({...caps, components:['example.counter','example.counter']}), /components/);
});

test('0.1 retains its published surface restrictions; migration is explicit', () => {
  assert.throws(() => validateRequest({...request, version:'0.1'}), /surface/);
  assert.throws(() => createTurnState(scope, caps), /surface/);
  for (const surface of ['react','widget']) validateRequest({...request,version:'0.1',capabilities:{...caps,surface}});
  assert.throws(() => validateRequest({...request,version:'0.1',capabilities:{...caps,surface:'text'}}), /text-only/);
});

test('0.2 replication retains the requested version and rejects cross-version events and undeclared components', () => {
  const state = createTurnState(scope, caps, '0.2');
  const event = {version:'0.2', ...scope, sequence:1, turnRevision:0, type:'ui.create',
    block:{id:'counter',format:'dil',source:'{}',appData:{count:1},revision:1,requiredComponents:['example.counter'],profile:caps.profile}};
  assert.throws(() => reduceEvent(state,{...event,version:'0.1'}), /version mismatch/);
  assert.throws(() => reduceEvent(state,{...event,block:{...event.block,requiredComponents:['unregistered']}}), /Unsupported/);
  const next = reduceEvent(state,event);
  assert.equal(next.protocolVersion,'0.2');
  assert.equal(next.blocks[0].appData.count,1);
});
