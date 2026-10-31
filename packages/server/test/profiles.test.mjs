import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatHandler,createUiProfile,createOpenAiProvider} from '../src/index.js';
import {startTurn} from '@intlui/client';
import {UI_PROFILE} from '@intlui/protocol';

const profile={id:'example.counter',version:'0.1'};
const adapter={profile,instructions:'COUNTER_PROFILE_JSON_ONLY',compile(source){const artifact=JSON.parse(source);if(artifact.kind!=='counter')throw Error('Wrong grammar');return {artifact,requiredComponents:['button','text']};},validateData(artifact,data){if(!Number.isInteger(data.count)||data.count<0)throw Error('Invalid count');}};
const input=(extra={})=>({version:'0.1',requestId:crypto.randomUUID(),intent:'Counter',input:{mode:'generate',text:'Facts'},capabilities:{surface:'react',formats:['dil'],components:['button','text'],profile},...extra});
const raw=(handler,request)=>handler(new Request('http://localhost/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)}));
const run=(handler,request=input(),onState)=>startTurn({endpoint:'http://localhost/chat',request,onState,fetchImpl:(url,init)=>handler(new Request(url,init))});
const provider=(translate)=>({id:'test',modes:['generate'],async *generate(){yield 'Known fact.';},translate:translate||async function*(){yield {type:'create',id:'counter',source:'{"kind":"counter"}',appData:{count:1}};}});
const make=(extra={})=>createChatHandler({provider:provider(),profiles:[createUiProfile(),adapter],authenticate:()=>({userId:'user'}),limits:{initialBatchChars:1,initialFlushMs:1,flushMs:1},...extra});

test('built-in UI works as an explicit profile and local custom demo completes data revisions',async()=>{
  const handler=make({provider:provider(async function*(){yield {type:'create',id:'ui',source:'<text>Hello</text>',appData:{}};})});
  const state=await run(handler,input({capabilities:{...input().capabilities,profile:UI_PROFILE}}));
  assert.equal(state.status,'complete');assert.deepEqual(state.blocks[0].profile,UI_PROFILE);
  const {createDemoChat}=await import('../../../examples/profiles/chat-server.mjs');
  const demo=await run(createDemoChat());
  assert.equal(demo.status,'complete');assert.equal(demo.blocks[0].appData.count,2);
  assert.equal(demo.blocks[0].revision,2);
});

test('unknown and denied profiles fail before source/provider calls, without UI fallback',async()=>{
  let calls=0;
  const handler=make({provider:{...provider(),async *generate(){calls++;yield 'Facts';}}});
  for(const selected of [{id:'unknown',version:'0.1'},{...profile,version:'2'}]){
    const response=await raw(handler,input({capabilities:{...input().capabilities,profile:selected}}));
    assert.equal(response.status,400);assert.equal((await response.json()).error.code,'unsupported_profile');
  }
  const denied=make({authorizeProfile:()=>false,provider:{...provider(),async *generate(){calls++;yield 'Facts';}}});
  assert.equal((await raw(denied,input())).status,403);assert.equal(calls,0);
  assert.throws(()=>make({profiles:[adapter,adapter]}),/Duplicate/);
  assert.throws(()=>make({profiles:[{...adapter,validateData:undefined}]}),/Invalid/);
});

test('custom grammar compiles once; every update is validated before emission',async()=>{
  let compiles=0,validations=0;const seen=[];
  const handler=make({profiles:[{...adapter,compile(source){compiles++;return adapter.compile(source);},validateData(artifact,data){validations++;adapter.validateData(artifact,data);}}],provider:provider(async function*(options){
    assert.deepEqual(options.profile,profile);assert.equal(options.instructions,adapter.instructions);
    yield {type:'create',id:'counter',source:'{"kind":"counter"}',appData:{count:1}};
    yield {type:'data',id:'counter',appData:{count:2}};
    yield {type:'data',id:'counter',appData:{count:-1}};
  })});
  const state=await run(handler,input(),state=>seen.push(state));
  assert.equal(state.status,'partial');assert.equal(state.blocks[0].appData.count,2);
  assert.equal(compiles,1);assert.equal(validations,3);assert.deepEqual(state.blocks[0].profile,profile);
  assert(seen.every(state=>state.blocks.every(block=>block.appData.count>=0)));
});

test('profile replacement from model operations and cross-profile history are rejected',async()=>{
  const handler=make();const first=await run(handler);
  const response=await raw(handler,input({previousTurnId:first.turnId,capabilities:{...input().capabilities,profile:UI_PROFILE}}));
  assert.equal(response.status,409);assert.equal((await response.json()).error.code,'conversation_profile_mismatch');
  const mismatch=await run(make({provider:provider(async function*(){yield {type:'create',id:'x',profile:UI_PROFILE,source:'{"kind":"counter"}',appData:{count:1}};})}));
  assert.equal(mismatch.status,'partial');assert.equal(mismatch.blocks.length,0);
  const wrong=await run(make({provider:provider(async function*(){yield {type:'create',id:'x',source:'<text>Wrong grammar</text>',appData:{count:1}};})}));
  assert.equal(wrong.status,'partial');assert.equal(wrong.blocks.length,0);
});

test('a false async validator rejects a revision and cannot mutate prior wire data',async()=>{
  let prior;
  const handler=make({profiles:[{...adapter,async validateData(artifact,data,context){
    if(context.previousAppData){prior=context.previousAppData.count;context.previousAppData.count=900;data.count=800;return false;}
    adapter.validateData(artifact,data);
  }}],provider:provider(async function*(){
    yield {type:'create',id:'counter',source:'{"kind":"counter"}',appData:{count:1}};
    yield {type:'data',id:'counter',appData:{count:2}};
  })});
  const state=await run(handler);
  assert.equal(prior,1);assert.equal(state.status,'partial');
  assert.equal(state.blocks[0].revision,1);assert.deepEqual(state.blocks[0].appData,{count:1});
});

test('OpenAI translator receives server-owned profile instructions, not the UI grammar',async()=>{
  const bodies=[];
  const openai=createOpenAiProvider({apiKey:'test-key',model:'test-model',fetchImpl:async(url,init)=>{
    const body=JSON.parse(init.body);bodies.push(body);
    const text=bodies.length===1?'Known fact.':JSON.stringify({type:'create',id:'x',source:'{"kind":"counter"}',appData:{count:1}})+'\n';
    return new Response(`data: ${JSON.stringify({type:'response.output_text.delta',delta:text})}\n\ndata: ${JSON.stringify({type:'response.completed',response:{status:'completed'}})}\n\n`);
  }});
  const state=await run(make({provider:openai}));assert.equal(state.status,'complete');
  const translated=bodies.find(body=>body.instructions.includes(adapter.instructions));assert(translated);
  assert(!translated.instructions.includes('DIL.useState'));assert.deepEqual(JSON.parse(translated.input[0].content).profile,profile);
});


test('0.2 transports an application-owned surface and component through the real client/server pipeline', async () => {
  const {serverProfile} = await import('../../../examples/profiles/custom-counter.js');
  const handler = make({profiles:[serverProfile],provider:provider(async function* () {
    yield {type:'create',id:'external',source:'{"kind":"counter","label":"External"}',appData:{count:1}};
    yield {type:'data',id:'external',appData:{count:2}};
  })});
  const request = input({version:'0.2',capabilities:{surface:'example.native',formats:['dil'],components:['example.counter'],profile:serverProfile.profile}});
  const state = await run(handler,request);
  assert.equal(state.status,'complete'); assert.equal(state.protocolVersion,'0.2');
  assert.equal(state.blocks[0].appData.count,2);
  assert.deepEqual(state.blocks[0].requiredComponents,['example.counter']);
  const denied = await run(handler,{...request,requestId:crypto.randomUUID(),capabilities:{...request.capabilities,components:['other']}});
  assert.equal(denied.blocks.length,0); assert.equal(denied.status,'partial');
  assert.equal((await raw(handler,{...request,version:'0.1'})).status,400);
});
