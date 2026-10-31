import {setTimeout as delay} from 'node:timers/promises';
import {createChatHandler} from '@intlui/server';
import {serverProfile} from './counter.js';
import {serverProfile as customProfile} from './custom-counter.js';

export function createDemoChat() {
  return createChatHandler({profiles:[serverProfile,customProfile], authenticate:() => ({userId:'local-demo'}),
    provider:{id:'synthetic-counter', modes:['generate'], async *generate({signal}) {
      yield 'Synthetic counter starts at 1. ';
      await delay(1500, undefined, {signal});
      yield 'Synthetic counter now becomes 2.';
    }, async *translate({blocks}) {
      yield blocks.length ? {type:'data', id:'counter', appData:{count:2}} :
        {type:'create', id:'counter', source:JSON.stringify({kind:'counter',label:'Server count'}), appData:{count:1}};
    }}, limits:{initialBatchChars:1,initialFlushMs:10,flushMs:10}});
}
