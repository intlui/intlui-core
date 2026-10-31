import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=JSON.parse(await readFile('package.json','utf8'));
assert(/^0\.\d+\.\d+-beta\.\d+$/.test(root.version),'Only explicit beta versions may be published here');
assert(process.env.npm_execpath,'Run npm run publish:beta');
const stage=process.argv.includes('--stage');
assert(process.argv.slice(2).every(arg=>arg==='--stage'),'Unsupported publication option');
const names=['protocol','client','react','server'];
// Validate every manifest before uploading the first package.
for(const name of names) {
  const manifest=JSON.parse(await readFile(`packages/${name}/package.json`,'utf8'));
  assert.equal(manifest.name,`@intlui/${name}`);
  assert.equal(manifest.version,root.version);
  assert.equal(manifest.publishConfig.access,'public');
  assert.equal(manifest.publishConfig.tag,'beta');
  assert.equal(manifest.publishConfig.registry,'https://registry.npmjs.org/');
  assert.notEqual(manifest.private,true);
}
for(const name of ['protocol','client','react','server']) {
  const directory=`packages/${name}`;
  const manifest=JSON.parse(await readFile(`${directory}/package.json`,'utf8'));
  assert.equal(manifest.version,root.version);
  assert.equal(manifest.publishConfig.access,'public');
  console.log(`${stage?'Staging':'Publishing'} ${manifest.name}@${manifest.version} to beta`);
  const operation=stage?['stage','publish']:['publish'];
  const result=spawnSync(process.execPath,[process.env.npm_execpath,...operation,'--ignore-scripts','--access','public','--tag','beta','--registry','https://registry.npmjs.org/'],{cwd:directory,stdio:'inherit',windowsHide:true});
  if(result.status!==0) throw Error(`Publication stopped at ${manifest.name}. Earlier packages may already be published; inspect npm before retrying.`);
}
