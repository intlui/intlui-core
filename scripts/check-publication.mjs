import {execFileSync} from 'node:child_process';
import {readFile,lstat} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

// Inspect exactly the tracked and unignored candidate files, including new files.
// Never print file contents, credentials or local absolute paths.
// Trust only this explicitly invoked checkout for this read-only Git command.
// Windows users and automation may have different ownership SIDs.
const checkout=fileURLToPath(new URL('../',import.meta.url)).replace(/\\/g,'/').replace(/\/$/,'');
process.chdir(checkout);
const files=[...new Set(execFileSync('git',['-c',`safe.directory=${checkout}`,'ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const root=JSON.parse(await readFile('package.json','utf8'));
const forbidden=/(?:^|\/)(?:node_modules|dist|coverage|captures|test-output|\.next|\.aws|\.codex|\.agents)(?:\/|$)|\.(?:log|tgz|pem|key|sqlite|db)$/i;
for(const path of files){
  assert(!forbidden.test(path),`Excluded material in publication: ${path}`);
  assert(!/(?:^|\/)\.env(?:\.|$)/.test(path)||path.endsWith('/.env.example'),`Environment file: ${path}`);
  const stat=await lstat(path);assert(stat.isFile()&&!stat.isSymbolicLink(),`Unexpected file type: ${path}`);
  assert(stat.size<2000000,`Review oversized file: ${path}`);
  const source=await readFile(path,'utf8');
  assert(!/(?:[A-Za-z]:[\\/]Users[\\/]|\/(?:Users|home)\/)[^\s"'<>]+/i.test(source),`Personal path: ${path}`);
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}/.test(source),`Potential credential: ${path}`);
  if(path.endsWith('package.json')){
    const manifest=JSON.parse(source);
    if(path.startsWith('packages/')) {
      assert.equal(manifest.publishConfig?.access,'public');
      assert.equal(manifest.publishConfig?.tag,'beta');
      assert.equal(manifest.publishConfig?.registry,'https://registry.npmjs.org/');
    } else assert.equal(manifest.private,true,`Root and examples must remain private: ${path}`);
    assert.equal(manifest.version,root.version,`Package version mismatch: ${path}`);
    for(const [name,version] of Object.entries(manifest.dependencies??{}))if(name.startsWith('@intlui/'))assert.equal(version,root.version,`Internal dependency mismatch: ${path}`);
  }
}
const lock=JSON.parse(await readFile('package-lock.json','utf8'));assert.equal(lock.version,root.version);
for(const [path,entry] of Object.entries(lock.packages))if(path===''||path.startsWith('packages/'))assert.equal(entry.version,root.version,`Lockfile version mismatch: ${path}`);
for(const required of ['LICENSE','NOTICE','README.md','AGENTS.md','VERSIONING.md','TESTING.md','CONTRIBUTING.md','SECURITY.md','CHANGELOG.md','.github/workflows/ci.yml'])assert(files.includes(required),`Missing publication file: ${required}`);
console.log(`Checked ${files.length} Git candidate files, version consistency and public-content boundaries. Heuristic checks do not replace manual secret review.`);
