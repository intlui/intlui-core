import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {diagnosticsDirectory, chromeExecutable} from './local-diagnostics.mjs';

const mode=process.argv[2];
assert(['profiles','next'].includes(mode),'Choose profiles or next');
const {default:puppeteer}=await import(process.env.INTLUI_BROWSER_DRIVER || 'puppeteer-core');
const output=await diagnosticsDirectory(`browser-${mode}`);
console.log('Local diagnostics:',output);
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;await new Promise(done=>probe.close(done));
const origin=`http://127.0.0.1:${port}`;
const cwd=mode==='next'?resolve(process.env.INTLUI_NEXT_CONSUMER || 'examples/next-chat'):process.cwd();
const args=mode==='next'?[join(cwd,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)]:['examples/profiles/server.mjs'];
const env={...process.env,PORT:String(port),INTLUI_DEMO:'1',NEXT_TELEMETRY_DISABLED:'1'};
delete env.OPENAI_API_KEY;
const app=spawn(process.execPath,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='',browser,spawnError;
app.on('error',error=>{spawnError=error;});
app.stdout.on('data',chunk=>logs+=chunk);app.stderr.on('data',chunk=>logs+=chunk);
try {
  let ready=false;
  for(let attempt=0;attempt<120;attempt++) {
    if(spawnError)throw spawnError;
    if(app.exitCode!==null)throw Error(`Server exited: ${app.exitCode}`);
    try {if((await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
    await delay(250);
  }
  assert(ready,'Server did not become ready');
  console.log('Server ready:',mode);
  browser=await puppeteer.launch({executablePath:chromeExecutable(),headless:true,
    timeout:20000,protocolTimeout:20000,userDataDir:await mkdtemp(join(output,'chrome-'))});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin,{waitUntil:'networkidle0'});
  console.log('Page loaded:',mode);
  if(mode==='profiles') {
    await page.click('main > button');
    await page.waitForFunction(()=>document.body.textContent.includes('Server count: 1; local clicks: 0'));
    await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Increment local counter');window.savedCounter=button;button.click();});
    await page.waitForFunction(()=>document.body.textContent.includes('Server count: 2; local clicks: 1'));
    assert(await page.evaluate(()=>window.savedCounter===[...document.querySelectorAll('button')].find(b=>b.textContent==='Increment local counter')),'Data revision must retain the same control');
    await page.click('main > button:nth-of-type(2)');
    await page.waitForFunction(()=>!document.body.textContent.includes('Server count:'));
    await page.click('main > button');
    await page.waitForFunction(()=>document.body.textContent.includes('Server count: 2; local clicks: 0'));
    assert(await page.evaluate(()=>!window.savedCounter.isConnected),'Reset must remove the previous renderer');
    console.log('Passed: protocol 0.2 custom surface/component, streamed data, DOM identity, local state and conversation reset.');
  } else {
    await page.waitForSelector('form button:not([disabled])');
    console.log('Next client hydrated');
    await page.click('form button');
    await page.waitForSelector('input[type=checkbox]');
    console.log('Next first interactive block rendered');
    await page.click('input[type=checkbox]');
    await page.waitForFunction(()=>![...document.querySelectorAll('button')].some(b=>b.textContent==='Stop'));
    assert(await page.$eval('input[type=checkbox]',el=>el.checked));
    await page.type('textarea','Second synthetic message');
    await page.click('form button');
    await page.waitForFunction(()=>document.body.textContent.includes('Previous turns: 1.'));
    console.log('Next conversation history verified');
    await page.waitForFunction(()=>![...document.querySelectorAll('button')].some(b=>b.textContent==='Stop'));
    assert(await page.$eval('input[type=checkbox]',el=>el.checked),'Earlier interaction must survive the next turn');
    await page.type('textarea','Cancel this turn');await page.click('form button');
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Stop'));
    await page.click('form button');
    await page.waitForFunction(()=>![...document.querySelectorAll('button')].some(b=>b.textContent==='Stop'));
    assert(await page.$eval('input[type=checkbox]',el=>el.checked),'Cancellation must retain earlier blocks');
    await page.click('main > button');
    await page.waitForFunction(()=>document.querySelectorAll('article').length===0);
    assert.equal(await page.$$eval('[role=alert]',els=>els.length),0);
    console.log('Passed: Next production hydration, route streaming, DIL interaction, history, cancellation and reset.');
  }
  assert.deepEqual(errors,[]);
  await page.screenshot({path:join(output,'result.png'),fullPage:true});
} catch (error) {
  console.error(logs.slice(-8000));
  if(browser) {
    const pages=await browser.pages();const page=pages.at(-1);
    console.error('Page text:',await page?.evaluate(()=>document.body.innerText));
    await page?.screenshot({path:join(output,'failure.png'),fullPage:true});
  }
  throw error;
} finally {
  await browser?.close();
  if(app.exitCode===null){const closed=once(app,'close');app.kill();await closed;}
  await writeFile(join(output,'server.log'),logs);
}
