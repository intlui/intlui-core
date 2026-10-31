import {readdir, readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {join} from 'node:path';

const root = JSON.parse(await readFile('package.json', 'utf8'));
assert.deepEqual(root.workspaces, ['packages/*']);
let count = 0;
for (const name of ['protocol', 'client', 'react', 'server']) {
  const manifest = JSON.parse(await readFile(`packages/${name}/package.json`, 'utf8'));
  assert.equal(manifest.license, 'Apache-2.0');
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(manifest.publishConfig?.tag, 'beta');
}
async function walk(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (['node_modules', 'dist', '.git', '.next'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    assert(entry.name === '.env.example' || !/^(?:captures|test-output|\.env.*|\.capture-profile.*)$/.test(entry.name), `Private material: ${path}`);
    assert(!entry.isSymbolicLink(), `Unexpected symlink: ${path}`);
    if (entry.isDirectory()) await walk(path);
    else {
      if (/\.(?:[cm]?js|jsx|tsx?|md|txt|json|css|ya?ml)$/.test(path)) {
        const source=await readFile(path,'utf8');
        assert(!/(?:[A-Za-z]:[\\/]Users[\\/]|\/(?:Users|home)\/)[^\s"'<>]+/i.test(source),`Personal filesystem path: ${path}`);
      }
      if (!/\.(?:js|mjs)$/.test(path)) continue;
      const result = spawnSync(process.execPath, ['--check', path], {encoding: 'utf8'});
      assert.equal(result.status, 0, `${path}: ${result.stderr}`);
      count++;
    }
  }
}
await walk('.');
console.log(`Checked public boundaries and ${count} JavaScript files. JSX is verified by builds.`);
