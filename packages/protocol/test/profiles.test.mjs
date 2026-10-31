import test from 'node:test';
import assert from 'node:assert/strict';
import {UI_PROFILE,validateProfile,profileKey,validateRequest,validateEvent,createTurnState,reduceEvent,supportsBlock} from '../src/index.js';

const profile={id:'example.counter',version:'0.1'};
const capabilities={surface:'react',formats:['dil'],components:['button'],profile};
const scope={projectId:'p',conversationId:'c',turnId:'t'};
const request={version:'0.1',requestId:'r',intent:'Facts',input:{mode:'generate',text:'hello'},capabilities};
const block={id:'a',format:'dil',source:'{"step":1}',appData:{count:0},revision:1,requiredComponents:['button'],profile};
const event=(sequence,type,extra={})=>({version:'0.1',...scope,sequence,turnRevision:0,type,...extra});

test('profile identity is explicit, bounded and independent of protocol version',()=>{
  validateRequest(request);
  for(const value of [{},null,{id:'x',version:''},{id:'x',version:'0.1',url:'https://example.com'}, {id:'x'.repeat(129),version:'0.1'}])assert.throws(()=>validateProfile(value));
  assert.notEqual(profileKey({id:'a:b',version:'c'}),profileKey({id:'a',version:'b:c'}));
  assert.throws(()=>validateRequest({...request,version:'0.2'}),/protocol/);
  validateRequest({...request,capabilities:{surface:'react',formats:['dil'],components:['button']}});
  assert.throws(()=>validateRequest({...request,version:'0.3'}),/protocol/);
  assert.throws(()=>createTurnState(scope,capabilities,'0.2'),/protocol/);
});

test('replication rejects profile/version substitution and preserves profile on updates',()=>{
  let state=createTurnState(scope,capabilities);
  for(const other of [{id:profile.id,version:'2'},UI_PROFILE])assert.throws(()=>reduceEvent(state,event(1,'ui.create',{block:{...block,profile:other}})),/Unsupported/);
  assert.throws(()=>reduceEvent(state,{...event(1,'text.delta',{text:'bad'}),version:'0.2'}),/version/);
  assert.throws(()=>reduceEvent(state,event(1,'ui.create',{block:{...block,profile:undefined}})),/Unsupported/);
  state=reduceEvent(state,event(1,'ui.create',{block}));
  state=reduceEvent(state,event(2,'ui.data',{id:'a',revision:2,appData:{count:2}}));
  assert.deepEqual(state.blocks[0].profile,profile);assert.equal(state.blocks[0].source,block.source);
  assert.throws(()=>reduceEvent(state,event(3,'ui.data',{id:'a',revision:3,appData:{count:3},profile:UI_PROFILE})),/unknown field/);
  assert.throws(()=>reduceEvent(state,event(3,'ui.create',{block:{...block,profile:UI_PROFILE}})));
});

test('implicit and explicit UI use protocol 0.1 with matching capabilities',()=>{
  const {profile:ignored,...legacyCaps}=capabilities;
  const {profile:ignoredBlock,...legacyBlock}=block;
  assert(supportsBlock(legacyCaps,legacyBlock));
  assert(!supportsBlock(legacyCaps,{...block,profile:UI_PROFILE}));
  assert(!supportsBlock({...capabilities,profile:UI_PROFILE},legacyBlock));
  validateRequest({...request,version:'0.1',capabilities:legacyCaps});
  const state=createTurnState(scope,legacyCaps);
  assert.equal(reduceEvent(state,{...event(1,'text.delta',{text:'legacy'}),version:'0.1'}).text,'legacy');
});
