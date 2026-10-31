import test from 'node:test';
import assert from 'node:assert/strict';
import {startTurn} from '@intlui/client';
import {createExampleChat} from '../../../examples/next-chat/chat-server.mjs';

test('Next example accepts only its configured public origin and still requires authentication', async () => {
  const origin='https://chat.example';
  const handler=createExampleChat({INTLUI_DEMO:'1',CHAT_ORIGIN:origin});
  const request={version:'0.1',requestId:'public-origin',intent:'Checklist',input:{mode:'generate',text:'Plan'},capabilities:{surface:'react',formats:['dil'],components:['text','checkbox']}};
  const make=(source,token='next-demo-session')=>new Request('http://internal-host/api/chat',{method:'POST',headers:{origin:source,authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(request)});
  assert.equal((await handler(make('https://untrusted.example'))).status,403);
  assert.equal((await handler(make(origin,''))).status,401);
  assert.equal((await createExampleChat({INTLUI_DEMO:'1'})(make(origin))).status,403);
  const response=await handler(make(origin));assert.equal(response.status,200);
  const terminal=JSON.parse((await response.text()).trim().split('\n').at(-1));
  assert.equal(terminal.type,'turn.end');assert.equal(terminal.status,'complete');
  assert.throws(()=>createExampleChat({INTLUI_DEMO:'1',CHAT_ORIGIN:'https://chat.example/path'}),/exact HTTP/);
});

test('Next example route runs standalone with explicit demo configuration', async () => {
  const previous=process.env.INTLUI_DEMO;
  process.env.INTLUI_DEMO='1';
  try {
    const {POST}=await import('../../../examples/next-chat/app/api/chat/route.js');
    const state=await startTurn({endpoint:'http://localhost/api/chat',token:'next-demo-session',
      request:{version:'0.1',requestId:'next-route-test',intent:'Checklist',input:{mode:'generate',text:'Plan'},capabilities:{surface:'react',formats:['dil'],components:['text','checkbox']}},
      fetchImpl:(url,init)=>POST(new Request(url,init))});
    assert.equal(state.status,'complete');assert.equal(state.blocks.length,1);
  } finally {if(previous===undefined)delete process.env.INTLUI_DEMO;else process.env.INTLUI_DEMO=previous;}
});
