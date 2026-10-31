import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const names=['protocol','client','react','server'];
const dependencies={react:'^19.0.0','react-dom':'^19.0.0'};
const pending=new Set(names);
// npm accepts publication before all registry mirrors expose the version/tag.
for(let attempt=1;attempt<=20 && pending.size;attempt++) {
for(const name of [...pending]){
  const id=`@intlui/${name}`;
  const response=await fetch(`https://registry.npmjs.org/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(30000)});
  if(response.status===404) continue;
  assert(response.ok,`${id}: registry HTTP ${response.status}`);
  const data=await response.json();
  if(data['dist-tags']?.beta!==version || data.versions[version]?.version!==version) {
    console.log(`${id}: awaiting ${version}; beta=${data['dist-tags']?.beta ?? 'missing'}`);
    continue;
  }
  assert(data.versions[version].dist.integrity,`${id}: missing integrity`);
  dependencies[id]=version;
  console.log(`${id}@${version}: beta tag and registry integrity verified`);
  pending.delete(name);
}
if(pending.size && attempt<20) {
  console.log(`Registry propagation pending (attempt ${attempt}/20); checking again in 15 seconds.`);
  await delay(15000);
}
}
assert.equal(pending.size,0,`Registry propagation timed out for: ${[...pending].join(', ')}. Re-run verification only; do not republish.`);
const directory=await mkdtemp(join(tmpdir(),'intlui-registry-release-'));
await writeFile(join(directory,'package.json'),JSON.stringify({name:'intlui-registry-smoke',private:true,type:'module',dependencies}));
const npm=process.env.npm_execpath;assert(npm,'Run through npm');
const install=spawnSync(process.execPath,[npm,'install','--no-audit','--no-fund'],{cwd:directory,stdio:'inherit',windowsHide:true});
assert.equal(install.status,0,'Fresh registry installation failed');
await writeFile(join(directory,'verify.mjs'),`import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {compileDil} from '@intlui/react/compiler';
import {DilSource} from '@intlui/react';
import {startTurn} from '@intlui/client';
import {createChatHandler} from '@intlui/server';
assert.equal(typeof startTurn,'function');assert.equal(typeof createChatHandler,'function');
assert(compileDil('<text>Registry smoke</text>').payload.code);
assert.equal(typeof renderToStaticMarkup(React.createElement(DilSource,{source:'<text>Registry smoke</text>'})),'string');
console.log('Fresh published-package imports, compiler and static React rendering passed');
`);
const smoke=spawnSync(process.execPath,[join(directory,'verify.mjs')],{cwd:directory,stdio:'inherit',windowsHide:true});
assert.equal(smoke.status,0,'Published package smoke failed');
