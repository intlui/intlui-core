import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createServer} from 'vite';
import {diagnosticsDirectory, chromeExecutable} from './local-diagnostics.mjs';

// Optional browser tooling is kept out of the distributed library.
const {default:puppeteer}=await import(process.env.INTLUI_BROWSER_DRIVER || 'puppeteer-core');
const output=await diagnosticsDirectory('advanced-browser');
console.log('Local diagnostics:',output);
const profile=await mkdtemp(join(output,'chrome-'));
const server=await createServer({root:resolve('examples/advanced'),configFile:false,server:{host:'127.0.0.1',port:0}});
let browser;
try {
  await server.listen();const port=server.httpServer.address().port;
  browser=await puppeteer.launch({executablePath:chromeExecutable(),headless:true,timeout:15000,protocolTimeout:15000,userDataDir:profile});
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle0'});
  await page.waitForSelector('textarea');await page.focus('textarea');
  const modifier=process.platform==='darwin'?'Meta':'Control';
  await page.keyboard.down(modifier);await page.keyboard.press('KeyA');await page.keyboard.up(modifier);
  await page.keyboard.press('Backspace');await page.type('textarea','Persistent note');
  await page.waitForFunction(()=>document.querySelector('textarea')?.value==='Persistent note');
  await page.click('main > button');
  await page.waitForFunction(()=>document.body.textContent.includes('Update 1'));
  assert.equal(await page.$eval('textarea',element=>element.value),'Persistent note');
  await page.click('nav button:nth-child(2)');await page.waitForSelector('input[type=checkbox]');await page.click('input[type=checkbox]');
  await page.waitForFunction(()=>document.body.textContent.includes('Tick: 1'));
  await page.click('nav button:nth-child(4)');await page.waitForFunction(()=>document.body.textContent.includes('First illustrative measurement: 12'));
  await page.waitForSelector('[data-d-component="geo-map"] svg');
  await page.screenshot({path:join(output,'advanced.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('Passed: advanced sandbox, form state across data updates, timer, local data and map rendering.');
} finally {await browser?.close();await server.close();await writeFile(join(output,'run.txt'),'Browser test invocation finished. Consult the command exit status for its result.\n');}
