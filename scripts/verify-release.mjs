import {spawn} from 'node:child_process';
import {mkdir, writeFile, cp, readFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {diagnosticsDirectory} from './local-diagnostics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw Error('Run npm run verify:release');
const output = await diagnosticsDirectory('release-verification');
const tooling = join(output, 'tooling'), consumer = join(output, 'next-consumer');
const results = [];
const env = {...process.env, INTLUI_DEMO:'1', NEXT_TELEMETRY_DISABLED:'1',
  INTLUI_DIAGNOSTICS_DIR:output, npm_config_cache:join(output, 'npm-cache'),
  npm_config_fetch_retries:'0', npm_config_fetch_timeout:'30000'};
// The integration check must not inherit production provider credentials.
delete env.OPENAI_API_KEY;
console.log(`Release verification. No publication or paid model calls.\nLogs: ${output}`);

async function command(name, args, cwd = root, extraEnv = {}) {
  console.log(`Running: ${name}`);
  const log = join(output, `${name}.log`), stream = createWriteStream(log);
  const status = await new Promise(resolveStatus => {
    const child = spawn(process.execPath, args, {cwd, env:{...env, ...extraEnv}, windowsHide:true, stdio:['ignore','pipe','pipe']});
    child.stdout.pipe(stream, {end:false}); child.stderr.pipe(stream, {end:false});
    child.on('error', error => {stream.write(String(error));});
    child.on('close', code => resolveStatus(code === 0 ? 'passed' : 'failed'));
  });
  await new Promise(done => stream.end(done));
  results.push({name, status, log});
  console.log(`${status.toUpperCase()}: ${name}`);
  if (status === 'failed') console.error((await readFile(log, 'utf8')).slice(-12000));
  return status === 'passed';
}
const npmRun = name => [npm, 'run', name];
try {
  const installed = await command('install-core', [npm, 'ci']);
  if (!installed) throw Error('Core dependencies could not be installed. See install-core.log.');
  await command('source-check', npmRun('check'));
  await command('publication-check', npmRun('check:publication'));
  await command('unit-tests', npmRun('test'));
  const built = await command('build', npmRun('build'));
  if (!built) throw Error('Build failed; browser and consumer checks require built packages.');

  await mkdir(tooling, {recursive:true});
  await writeFile(join(tooling, 'package.json'), JSON.stringify({name:'intlui-verification-tooling', private:true, type:'module'}));
  const driverReady = await command('install-browser-tooling', [npm, 'install', '--no-audit', '--no-fund', 'puppeteer-core'], tooling);
  await command('browser-chat', npmRun('test:browser:chat'));
  if (driverReady) {
    const require = createRequire(join(tooling, 'package.json'));
    await command('browser-advanced', npmRun('test:browser:advanced'), root,
      {INTLUI_BROWSER_DRIVER:pathToFileURL(require.resolve('puppeteer-core')).href});
    await command('browser-profiles', ['scripts/test-release-browser.mjs','profiles'], root,
      {INTLUI_BROWSER_DRIVER:pathToFileURL(require.resolve('puppeteer-core')).href});
  } else {
    for (const name of ['browser-advanced','browser-profiles']) results.push({name, status:'skipped', reason:'Browser driver installation failed'});
  }

  const packed = await command('pack-packages', npmRun('pack:packages'));
  if (!packed) throw Error('Archive preparation failed.');
  await mkdir(consumer, {recursive:true});
  await cp(join(root, 'examples/next-chat'), consumer, {recursive:true,
    filter:path => !resolve(path).slice(resolve(root, 'examples/next-chat').length).split(/[\\/]/).some(part => ['node_modules','.next','dist'].includes(part) || (part.startsWith('.env') && part !== '.env.example'))});
  const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  const archives = ['protocol','client','react','server'].map(name => join(root, 'dist/packages', `intlui-${name}-${version}.tgz`));
  const consumerReady = await command('install-next-consumer', [npm, 'install', '--no-audit', '--no-fund', ...archives, 'typescript', '@types/react@19', '@types/react-dom@19', '@types/node'], consumer);
  if (consumerReady) {
    await cp(join(root, 'examples/typescript'), join(consumer, 'typecheck'), {recursive:true});
    await command('typescript-consumer', [join(consumer, 'node_modules/typescript/bin/tsc'), '-p', 'typecheck/tsconfig.json'], consumer);
    const nextBuilt = await command('next-build', npmRun('build'), consumer);
    if (nextBuilt && driverReady) {
      const require = createRequire(join(tooling, 'package.json'));
      await command('next-browser', ['scripts/test-release-browser.mjs','next'], root,
        {INTLUI_NEXT_CONSUMER:consumer,INTLUI_BROWSER_DRIVER:pathToFileURL(require.resolve('puppeteer-core')).href});
    } else results.push({name:'next-browser',status:'skipped',reason:'Next build or browser tooling unavailable'});
  } else {
    for (const name of ['typescript-consumer','next-build','next-browser']) results.push({name, status:'skipped', reason:'Consumer dependency installation failed'});
  }
} catch (error) {
  results.push({name:'verification', status:'failed', reason:error.message});
  console.error(error.message);
} finally {
  await writeFile(join(output, 'summary.json'), JSON.stringify({results, limitations:[
    'Single installed Chrome; no cross-browser coverage.',
    'Next production browser check uses synthetic chat; no live provider or deployment.',
    'Synthetic providers only; no live OpenAI calls.'
  ]}, null, 2));
  const summary = results.map(result => `${result.status.toUpperCase()}: ${result.name}${result.reason ? ` — ${result.reason}` : ''}`).join('\n');
  await writeFile(join(output, 'summary.txt'), summary + '\n');
  console.log(`\n${summary}\n\nShare this summary: ${join(output, 'summary.txt')}\nDetailed logs: ${output}`);
  if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
}
