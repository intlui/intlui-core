import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSource} from '../src/validate-source.js';
import {createChatHandler} from '../src/index.js';
import {startTurn} from '@intlui/client';
import {createRendererCapabilities} from '@intlui/react/capabilities';

const source='<textarea value="Editable"/><svg viewBox="0 0 10 10"><circle cx=5 cy=5 r=2/></svg><timer running={false}/>';
test('server accepts informational extension diagnostics and gates advanced UI by client capabilities',async()=>{
  assert.deepEqual(validateSource(source),['circle','svg','textarea','timer']);
  assert.throws(()=>validateSource('<MapWidgetV2/>'),/Unsupported/);
  const provider={id:'test',modes:['generate'],async *generate(){yield 'Supplied facts';},async *translate(){yield {type:'create',id:'advanced',source,appData:{}};}};
  const handler=createChatHandler({provider,authenticate:()=>({userId:'user'}),limits:{initialBatchChars:1,initialFlushMs:1,flushMs:1}});
  const run=capabilities=>startTurn({endpoint:'http://localhost/chat',request:{version:'0.1',requestId:crypto.randomUUID(),intent:'Interactive facts',input:{mode:'generate',text:'hello'},capabilities},fetchImpl:(url,init)=>handler(new Request(url,init))});
  const advanced=await run(createRendererCapabilities());assert.equal(advanced.status,'complete');assert.equal(advanced.blocks.length,1);
  const limited=await run(createRendererCapabilities({components:['text']}));assert.equal(limited.status,'partial');assert.equal(limited.blocks.length,0);assert.equal(limited.text,'Supplied facts');
});
