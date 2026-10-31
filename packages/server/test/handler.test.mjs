import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {createChatHandler, createMemoryConversationStore, createOpenAiProvider} from '../src/index.js';
import {toNodeHandler} from '../src/node.js';
import {startTurn} from '@intlui/client';

const capabilities = {surface:'react', formats:['dil'], components:['text','checkbox']};
const request = (extra = {}) => ({version:'0.1', requestId:crypto.randomUUID(), intent:'Checklist', input:{mode:'generate',text:'Plan'}, capabilities, ...extra});
const provider = (overrides = {}) => ({id:'test', modes:['generate','translate'], async *generate() {yield 'First fact.'; yield ' Second fact.';},
  async *translate({delta, blocks}) {
    yield blocks.length ? {type:'data', id:'facts', appData:{text:blocks[0].appData.text + delta}} :
      {type:'create', id:'facts', source:'{@body const data=DIL.useAppData()}\n<text>{data.text}</text>',appData:{text:delta}};
  }, ...overrides});
const make = (options = {}) => createChatHandler({provider:provider(), authenticate:r => r.headers.get('authorization') ? {userId:r.headers.get('authorization')} : null,
  limits:{flushMs:1, initialFlushMs:1, initialBatchChars:1}, ...options});
const raw = (handler, input, token = 'alice', headers = {}) => handler(new Request('http://localhost/api/chat', {method:'POST',headers:{'content-type':'application/json', ...(token ? {authorization:`Bearer ${token}`} : {}),...headers},body:JSON.stringify(input)}));
const client = (handler, input = request(), token = 'alice', options = {}) => startTurn({endpoint:'http://localhost/api/chat',token,request:input,
  fetchImpl:(url, init) => handler(new Request(url, init)), ...options});

test('standalone handler streams validated UI and resolves only owner-scoped server history', async () => {
  const histories = [], handler = make({provider:provider({async *generate({text, history}) {histories.push(history); yield text;}})});
  const first = await client(handler);
  assert.equal(first.status,'complete'); assert.equal(first.blocks[0].appData.text,'Plan');
  const next = await client(handler, request({previousTurnId:first.turnId}));
  assert.equal(next.conversationId,first.conversationId);
  assert.deepEqual(histories[1],[{role:'user',content:'Plan'},{role:'assistant',content:'Plan'}]);
  assert.equal((await raw(handler,request({previousTurnId:first.turnId}),'bob')).status,404);
  assert.equal(histories.length,2);
});

test('auth, origins, input limits and duplicate admission reject before model calls', async () => {
  let calls = 0; const handler = make({provider:provider({async *generate() {calls++; yield 'ok';}}), limits:{maxInputChars:4,maxBodyBytes:1000}});
  assert.equal((await raw(handler,request(),null)).status,401);
  assert.equal((await raw(handler,request(),'alice',{origin:'https://attacker.invalid'})).status,403);
  assert.equal((await raw(handler,request({input:{mode:'generate',text:'too long'}}))).status,413);
  assert.equal((await raw(handler,{...request(),model:'injected'})).status,400);
  assert.equal((await raw(handler,request({input:{mode:'generate',text:'x'.repeat(2000)}}))).status,413);
  const input = request(); await client(handler,input);
  assert.equal((await raw(handler,input)).status,409); assert.equal(calls,1);
});

test('invalid translation preserves original text; upstream errors do not expose secrets', async () => {
  const bad = make({provider:provider({async *translate() {yield {type:'create',id:'bad',source:'<not-supported/>',appData:{}};}})});
  const result = await client(bad); assert.equal(result.status,'partial'); assert.match(result.text,/First fact/); assert.equal(result.blocks.length,0);
  const failure = await client(make({provider:provider({async *generate() {throw Error('sk-secret-private');}})}));
  assert.equal(failure.status,'failed'); assert(!JSON.stringify(failure).includes('sk-secret-private'));
});

test('disconnect aborts upstream work and releases admission capacity', async () => {
  let aborted = false, started;
  const ready = new Promise(resolve => {started = resolve;});
  const handler = make({limits:{maxConcurrentPerUser:1},provider:provider({async *generate({signal}) {
    try {started(); yield 'first'; await delay(5000,undefined,{signal});} finally {aborted = true;}
  }})});
  const stop = new AbortController();
  const running = client(handler,request(),'alice',{signal:stop.signal});
  await ready; assert.equal((await raw(handler,request())).status,429); stop.abort(); await assert.rejects(running);
  for (let i=0; i<50 && !aborted; i++) await delay(5);
  assert(aborted);
  await delay(10); const second = await raw(handler,request()); assert.equal(second.status,200); await second.body.cancel();
});

test('memory store clones data, scopes receipts and bounds retention', async () => {
  const store = createMemoryConversationStore({maxEntries:2});
  assert(await store.claim('a','same')); assert(!await store.claim('a','same')); assert(await store.claim('b','same'));
  await assert.rejects(store.claim('c','third'),/request_records_limit/);
  await store.save('a',{turnId:'one',text:'private'}); assert.equal(await store.get('b','one'),null);
  const copy = await store.get('a','one'); copy.text='changed'; assert.equal((await store.get('a','one')).text,'private');
});

test('Node adapter interoperates with a real HTTP client without the private platform', async t => {
  const server = createServer(toNodeHandler(make())); server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(() => {server.closeAllConnections(); server.close();});
  const result = await startTurn({endpoint:`http://127.0.0.1:${server.address().port}/api/chat`,token:'alice',request:request()});
  assert.equal(result.status,'complete'); assert(result.blocks.length);
});

test('OpenAI source and translator use Responses transport with server instructions', async () => {
  const bodies = [];
  const openai = createOpenAiProvider({apiKey:'test-key',model:'configured-model',instructions:'Use the supplied product facts.',fetchImpl:async (_, init) => {
    const body = JSON.parse(init.body); bodies.push(body);
    const text = body.instructions === 'Use the supplied product facts.' ? 'A real fact.' :
      JSON.stringify({type:'create',id:'facts',source:'<text>A real fact.</text>',appData:{}})+'\n';
    return new Response(`data: ${JSON.stringify({type:'response.output_text.delta',delta:text})}\n\ndata: ${JSON.stringify({type:'response.completed',response:{usage:{total_tokens:5}}})}\n\n`);
  }});
  const result = await client(make({provider:openai,limits:{initialBatchChars:1000}}));
  assert.equal(result.status,'complete'); assert.equal(result.text,'A real fact.'); assert.equal(bodies.length,2);
  assert(bodies.every(body => body.store === false && body.stream === true));
});
