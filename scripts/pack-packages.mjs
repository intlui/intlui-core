import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {diagnosticsDirectory} from './local-diagnostics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist/packages');
await mkdir(output, {recursive: true});
if (!process.env.npm_execpath) throw new Error('Run npm run pack:packages');
const cache=await diagnosticsDirectory('npm-pack');
for (const name of ['protocol', 'client', 'react', 'server']) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', '--json', '--ignore-scripts', '--cache', cache, '--pack-destination', output], {cwd: join(root, 'packages', name), encoding: 'utf8', windowsHide: true});
  if (result.status !== 0) throw new Error(result.stderr || `Cannot pack ${name}`);
  const [packed] = JSON.parse(result.stdout);
  console.log(`dist/packages/${packed.filename}`);
}
