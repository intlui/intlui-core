import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=JSON.parse(await readFile('package.json','utf8'));
assert(/^0\.\d+\.\d+-beta\.\d+$/.test(root.version),'Only explicit beta versions may be published here');
assert(process.env.npm_execpath,'Run npm run publish:beta');
for(const name of ['protocol','client','react','server']) {
  const directory=`packages/${name}`;
  const manifest=JSON.parse(await readFile(`${directory}/package.json`,'utf8'));
  assert.equal(manifest.version,root.version);
  assert.equal(manifest.publishConfig.access,'public');
  console.log(`Publishing ${manifest.name}@${manifest.version} to beta`);
  const result=spawnSync(process.execPath,[process.env.npm_execpath,'publish','--access','public','--tag','beta','--registry','https://registry.npmjs.org/'],{cwd:directory,stdio:'inherit',windowsHide:true});
  if(result.status!==0) throw Error(`Publication stopped at ${manifest.name}. Earlier packages may already be published; inspect npm before retrying.`);
}
