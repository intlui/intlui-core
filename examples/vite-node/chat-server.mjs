import {timingSafeEqual} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createChatHandler, createOpenAiProvider} from '@intlui/server';

// Explicit synthetic provider, never selected as a fallback for missing credentials.
function demoProvider() {
  return {id:'demo', modes:['generate','translate'], async *generate({text, history, signal}) {
    yield `Synthetic demo: ${text}\n`;
    await delay(250,undefined,{signal});
    yield `Review the content and try the controls. Previous turns: ${history.length / 2}.`;
  }, async *translate({delta, blocks, signal}) {
    await delay(120,undefined,{signal});
    yield blocks.length ? {type:'data',id:'checklist',appData:{text:blocks[0].appData.text + delta}} :
      {type:'create',id:'checklist',source:'{@body const data=DIL.useAppData()}\n{@body const [done,setDone]=DIL.useState(false)}\n<checkbox checked={done} onChange={setDone}>Review complete</checkbox>\n<text>{data.text}</text>',appData:{text:delta}};
  }};
}

export function createExampleChat(env = process.env) {
  const demo = env.INTLUI_DEMO === '1', expected = env.CHAT_SESSION_TOKEN;
  if (!demo && (!expected || expected.length < 24)) throw Error('Set CHAT_SESSION_TOKEN (at least 24 characters) or explicitly enable INTLUI_DEMO=1');
  const provider = demo ? demoProvider() : createOpenAiProvider({apiKey:env.OPENAI_API_KEY, model:env.OPENAI_MODEL,
    translationModel:env.OPENAI_TRANSLATION_MODEL || env.OPENAI_MODEL,
    instructions:'Respond in English. Preserve facts and qualifications; do not claim external actions that were not performed.'});
  return createChatHandler({provider, authenticate(request) {
    const header = request.headers.get('authorization') || '', value = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (demo) return /^[a-zA-Z0-9-]{16,128}$/.test(value) ? {userId:value} : null;
    const supplied = Buffer.from(value), target = Buffer.from(expected);
    return supplied.length === target.length && timingSafeEqual(supplied,target) ? {userId:'example-user'} : null;
  }, limits:{initialBatchChars:24,initialFlushMs:100,flushMs:100,maxTranslations:8}});
}
