import test from 'node:test';
import assert from 'node:assert/strict';
import {startTurn} from '@intlui/client';

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
