import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {diagnosticsDirectory, chromeExecutable} from './local-diagnostics.mjs';

const root=process.cwd(), output=await diagnosticsDirectory('browser-chat');
console.log('Local diagnostics:',output);
const profile=await mkdtemp(join(output,'chrome-'));
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const app=spawn(process.execPath,['examples/vite-node/server.mjs','--demo'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
let logs='';app.stdout.on('data',chunk=>logs+=chunk);app.stderr.on('data',chunk=>logs+=chunk);
let chrome,sequence=0,session;const pending=new Map();
const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++sequence, timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout: ${method}`));},15000);
  pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
  chrome.stdio[3].write(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})})+'\0');
});
const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value;};
async function until(fn,label,timeout=20000) {const end=Date.now()+timeout;while(Date.now()<end){try {if(await fn())return;}catch{}await delay(30);}throw Error(`Timed out: ${label}`);}
try {
  await until(async()=> (await fetch(`http://127.0.0.1:${port}/api/config`)).ok,'app start');
  chrome=spawn(chromeExecutable(),[
    '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-pipe',`--user-data-dir=${profile}`,'about:blank'
  ],{windowsHide:true,stdio:['ignore','ignore','ignore','pipe','pipe']});
  let buffer='';chrome.stdio[4].setEncoding('utf8');
  chrome.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))!==-1){const data=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const item=pending.get(data.id);if(item){pending.delete(data.id);data.error?item.reject(Error(data.error.message)):item.resolve(data.result);}}});
  const target=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:`http://127.0.0.1:${port}`});
  await until(()=>evaluate(`Boolean(document.querySelector('form button:not([disabled])'))`),'hydrated hook');
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await until(()=>evaluate(`Boolean(document.querySelector('input[type=checkbox]'))`),'DIL checkbox');
  await evaluate(`document.querySelector('input[type=checkbox]').click()`);
  await until(()=>evaluate(`!Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Stop')`),'stream complete');
  assert(await evaluate(`document.querySelector('input[type=checkbox]').checked`),'State must survive streaming updates');
  await evaluate(`(()=>{const input=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Second message');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(()=>evaluate(`!document.querySelector('form button').disabled`),'second prompt');await evaluate(`document.querySelector('form').requestSubmit()`);
  await until(()=>evaluate(`document.body.textContent.includes('Previous turns: 1.')`),'server conversation context');
  assert(await evaluate(`document.querySelector('input[type=checkbox]').checked`),'Earlier controls must remain mounted');
  await writeFile(join(output,'chat.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='New conversation').click()`);
  await until(()=>evaluate(`document.querySelectorAll('article').length===0`),'conversation reset');
  console.log('Browser passed: hook hydration, send, DIL interaction, state across streaming, server history and reset.');
} finally {
  if(chrome && chrome.exitCode===null){session=undefined;try {await send('Browser.close');}catch{}}
  for(const item of pending.values())item.reject(Error('Browser closed'));pending.clear();
  chrome?.kill();app.kill();await writeFile(join(output,'server.log'),logs);
}
