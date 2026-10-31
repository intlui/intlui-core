import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, readdir, cp, realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join, resolve, relative} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {diagnosticsDirectory} from './local-diagnostics.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)), npm=process.env.npm_execpath;
assert(npm,'Run npm run audit:consumer');
const directory=await mkdtemp(join(tmpdir(),'intlui-public-consumer-'));
const output=await diagnosticsDirectory('consumer');
const report={checks:[],limitations:['Dependencies are preseeded from the local installation; registry downloading is not tested. No live model call.']};
let stage=0;
async function run(args,cwd=directory) {
  const child=spawn(process.execPath,args,{cwd,windowsHide:true,env:{...process.env,NODE_PATH:'',npm_config_logs_dir:join(output,'npm-logs')},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.on('data',chunk=>stdout+=chunk);
  child.stderr.on('data',chunk=>stderr+=chunk);
  const timer=setTimeout(()=>child.kill(),120000); const [code]=await once(child,'exit');clearTimeout(timer);
  await writeFile(join(output,`${++stage}.log`),`STDOUT\n${stdout}\nSTDERR\n${stderr}`);
  assert.equal(code,0,`Consumer step failed: ${output}/${stage}.log`);
  return stdout;
}
try {
  await run([npm,'run','build'],root);
  const archives=[];
  for(const name of ['protocol','client','react','server']) {
    const [packed]=JSON.parse(await run([npm,'pack','--json','--ignore-scripts','--cache',join(output,'pack-cache'),'--pack-destination',directory],join(root,'packages',name)));
    assert(packed.files.some(file=>file.path==='LICENSE'));
    assert(packed.files.some(file=>file.path==='NOTICE'));
    assert(packed.files.every(file=>['package.json','README.md','LICENSE','NOTICE'].includes(file.path)||file.path.startsWith(name==='react'?'dist/':'src/')));
    for(const file of packed.files.filter(file=>/\.(?:[cm]?js|jsx|ts|json|md|css)$/.test(file.path))) {
      const contents=await readFile(join(root,'packages',name,file.path),'utf8');
      assert(!/(?:[A-Za-z]:[\\/]Users[\\/]|\/(?:Users|home)\/)[^\s"'<>]+/i.test(contents),`Personal filesystem path in ${name}/${file.path}`);
    }
    archives.push(join(directory,packed.filename));
  }
  await cp(join(root,'examples/vite-node'),directory,{recursive:true,filter:path=>!path.split(/[\\/]/).some(part=>['node_modules','dist','.env'].includes(part))});
  await writeFile(join(directory,'package.json'),JSON.stringify({name:'independent-intlui-consumer',private:true,type:'module',dependencies:{react:'19.3.1','react-dom':'19.3.1',vite:'8.3.5'}}));
  // Seed only third-party dependencies; IntlUI must be installed from the tarballs.
  await mkdir(join(directory,'node_modules'),{recursive:true});
  for(const entry of await readdir(join(root,'node_modules'),{withFileTypes:true})) {
    if(entry.name==='@intlui'||entry.name.startsWith('.'))continue;
    await cp(join(root,'node_modules',entry.name),join(directory,'node_modules',entry.name),{recursive:true,dereference:true});
  }
  const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
  lock.name='independent-intlui-consumer';delete lock.version;
  lock.packages=Object.fromEntries(Object.entries(lock.packages).filter(([path])=>path.startsWith('node_modules/')&&!path.startsWith('node_modules/@intlui/')));
  lock.packages['']=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));
  await writeFile(join(directory,'package-lock.json'),JSON.stringify(lock));
  await writeFile(join(directory,'node_modules/.package-lock.json'),JSON.stringify({...lock,packages:Object.fromEntries(Object.entries(lock.packages).filter(([path])=>path))}));
  // Reuse cached registry metadata without writing to the user's npm cache.
  const cache=createRequire(npm)('cacache');
  const sourceCache=(await run([npm,'config','get','cache'],root)).trim();
  const names=new Set(Object.keys(lock.packages).filter(path=>path.startsWith('node_modules/')).map(path=>path.split('node_modules/').at(-1)));
  const cacheKeys=[...names].map(name=>'make-fetch-happen:request-cache:https://registry.npmjs.org/'+name.replace('/', '%2f'));
  for(const value of Object.values(lock.packages)) if(value.resolved?.startsWith('https://registry.npmjs.org/'))cacheKeys.push('make-fetch-happen:request-cache:'+value.resolved);
  for(const key of cacheKeys) {
    try {
      const entry=await cache.get(join(sourceCache,'_cacache'),key);
      await cache.put(join(output,'pack-cache/_cacache'),key,entry.data,{metadata:entry.metadata});
    } catch(error) {if(error.code!=='ENOENT')throw error;}
  }
  await run([npm,'install','--offline','--cache',join(output,'pack-cache'),'--ignore-scripts','--legacy-peer-deps','--no-audit','--no-fund',...archives]);
  for(const name of ['protocol','client','react','server']) assert(!relative(await realpath(directory),await realpath(join(directory,'node_modules/@intlui',name))).startsWith('..'));
  report.checks.push('Four npm tarballs installed outside the repositories, including licenses; no workspace links.');
  await writeFile(join(directory,'verify.mjs'), `import assert from 'node:assert/strict';
import {createChatHandler} from '@intlui/server';
import {startTurn} from '@intlui/client';
import {createExampleChat} from './chat-server.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Tree} from '@intlui/react/primitives';
import {compileDil} from '@intlui/react/compiler';
import {createRendererCapabilities} from '@intlui/react/capabilities';
import {createRendererProfiles,DilSource} from '@intlui/react';
const profile={id:'example.independent',version:'0.1'};
const adapter={profile,compile(source){assert.equal(source,'count');return {artifact:{kind:'count'},requiredComponents:['example.external']};},validateData(artifact,data){assert(Number.isInteger(data.count));},instructions:'Use count source and integer count data.'};
const profiles=createRendererProfiles([{...adapter,components:['example.external'],Renderer:({appData})=>React.createElement('p',null,appData.count)}]);
const custom=createChatHandler({profiles:[adapter],authenticate:()=>({userId:'external'}),provider:{id:'synthetic',modes:['generate'],async *generate(){yield 'Fact';},async *translate(){yield {type:'create',id:'count',source:'count',appData:{count:3}};}}});
const customState=await startTurn({endpoint:'http://localhost/chat',request:{version:'0.2',requestId:'profile',intent:'Count',input:{mode:'generate',text:'Count'},capabilities:profiles.capabilities(profile,{surface:'example.external-host'})},fetchImpl:(url,init)=>custom(new Request(url,init))});
assert.equal(customState.status,'complete');assert.deepEqual(customState.blocks[0].profile,profile);
assert.match(renderToStaticMarkup(React.createElement(DilSource,{profile,profiles,source:'count',appData:customState.blocks[0].appData})),/>3</);
const compiled=compileDil('<textarea/><svg><circle cx=2 cy=2 r=1/></svg><timer/>');
assert(compiled.requiredComponents.every(name=>createRendererCapabilities().components.includes(name)));
assert.match(renderToStaticMarkup(React.createElement(Tree,{node:{type:'textarea',props:{value:'Standalone',onChange:{$callback:1}},children:[]},dispatch(){}})),/Standalone/);
const handler=createExampleChat({INTLUI_DEMO:'1'});
const state=await startTurn({endpoint:'http://localhost/api/chat',token:'independent-session',request:{version:'0.1',requestId:'independent',intent:'Checklist',input:{mode:'generate',text:'Hello'},capabilities:{surface:'react',formats:['dil'],components:['text','checkbox']}},fetchImpl:(url,init)=>handler(new Request(url,init))});
assert.equal(state.status,'complete');assert.equal(state.blocks.length,1);console.log('Independent public chat passed');
`);
  await run([join(directory,'verify.mjs')]);
  await run([join(directory,'node_modules/vite/bin/vite.js'),'build']);
  report.checks.push('Standalone server/client chat, custom profile round trip and React rendering, advanced compiler/primitives and Vite production build.');
} catch(error) {report.error=error.message;process.exitCode=1;}
await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
console.log('Local diagnostics:',output);
