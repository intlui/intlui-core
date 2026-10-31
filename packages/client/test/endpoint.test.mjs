import test from 'node:test';
import assert from 'node:assert/strict';
import {startTurn, translateTextStream} from '../src/index.js';
const request={version:'0.1',requestId:'custom-route',intent:'Text',input:{mode:'generate',text:'Hello'},capabilities:{surface:'text',formats:[],components:[]}};
test('custom same-origin routes allow application cookie auth without sending an undefined bearer', async () => {
  let sent;
  await startTurn({endpoint:'/api/chat',request,fetchImpl:async (url,init) => {
    sent={url,init}; return new Response(JSON.stringify({version:'0.1',projectId:'app',conversationId:'chat',turnId:'turn',sequence:1,turnRevision:0,type:'turn.end',status:'complete'})+'\n');
  }});
  assert.equal(sent.url,'/api/chat'); assert(!('Authorization' in sent.init.headers));
});
test('custom endpoints reject credential-bearing URLs, protocol-relative URLs and ambiguous base options', async () => {
  const options={request,fetchImpl:() => {throw Error('Must not fetch');}};
  for(const endpoint of ['//example.com/api','https://user:secret@example.com/api','file:///chat','/api/chat?secret=x','/api/chat#token','/\\example.com']) {
    await assert.rejects(startTurn({...options,endpoint}),TypeError);
  }
  await assert.rejects(startTurn({...options,endpoint:'/api/chat',apiBaseUrl:'https://example.com'}),TypeError);
  await assert.rejects(translateTextStream({endpoint:'/api/chat',source:async function*(){},request:{...request,input:{mode:'translate-stream',text:''}}}),/platform API/);
});
