import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatController} from '../src/chat-controller.js';
const capabilities = {surface:'text',formats:[],components:[]};
const events = id => [
  {type:'text.delta',text:'Answer'}, {type:'turn.end',status:'complete'}
].map((event,index) => ({version:'0.1',projectId:'test',conversationId:'chat',turnId:id,sequence:index+1,turnRevision:0,...event}));
const response = id => new Response(events(id).map(event => JSON.stringify(event)).join('\n'));

test('explicit profile capabilities select protocol 0.1 and profile conflicts require reset', async () => {
  let sent;
  const profile={id:'example.counter',version:'0.1'};
  const controller=createChatController({capabilities:{...capabilities,profile},endpoint:'/chat',fetchImpl:async(url,init)=>{
    sent=JSON.parse(init.body);
    return Response.json({error:{code:'conversation_profile_mismatch'}},{status:409});
  }});
  await assert.rejects(controller.send('Question'));
  assert.equal(sent.version,'0.1');assert.deepEqual(sent.capabilities.profile,profile);
  assert.equal(controller.getSnapshot().contextLost,true);
  controller.reset();assert.equal(controller.getSnapshot().contextLost,false);
});

test('controller continues from completed server turns and resets conversation identity', async () => {
  const sent = [], controller = createChatController({capabilities,endpoint:'/api/chat',fetchImpl:async (url,init) => {
    sent.push(JSON.parse(init.body)); return response(`turn-${sent.length}`);
  }});
  await controller.send('First'); await controller.send('Second');
  assert.equal(sent[1].previousTurnId,'turn-1'); assert.equal(controller.getSnapshot().items.length,2);
  assert.equal(controller.getSnapshot().busy,false);
  controller.reset(); await controller.send('New'); assert.equal(sent[2].previousTurnId,undefined);
});

test('stop and reset reject late state updates without discarding previous content', async () => {
  let finish;
  const controller = createChatController({capabilities,endpoint:'/api/chat',fetchImpl:() => new Promise(resolve => {finish=resolve;})});
  const running = controller.send('First'); controller.stop();
  assert.equal(controller.getSnapshot().busy,false); assert.equal(controller.getSnapshot().items[0].interruption,'cancelled');
  controller.reset(); finish(response('late')); await assert.rejects(running);
  assert.deepEqual(controller.getSnapshot().items,[]);
});

test('expired context requires explicit reset and does not automatically resend', async () => {
  let calls=0;
  const controller = createChatController({capabilities,endpoint:'/api/chat',fetchImpl:async () => {
    calls++; return Response.json({error:{code:'conversation_not_found'}},{status:404});
  }});
  await assert.rejects(controller.send('First')); assert.equal(controller.getSnapshot().contextLost,true);
  await assert.rejects(controller.send('No retry')); assert.equal(calls,1);
});

test('a second send while receiving cannot start another provider request', async () => {
  let finish, calls=0;
  const controller=createChatController({capabilities,endpoint:'/api/chat',fetchImpl:() => {calls++; return new Promise(resolve => {finish=resolve;});}});
  const running=controller.send('First'); await assert.rejects(controller.send('Second'));
  finish(response('first')); await running; assert.equal(calls,1);
});
