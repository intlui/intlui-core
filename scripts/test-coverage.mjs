import {spawn} from 'node:child_process';
import {readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {diagnosticsDirectory} from './local-diagnostics.mjs';

const output=await diagnosticsDirectory('coverage');
console.log('Local diagnostics:',output);
for(const name of ['protocol','client','react','server']){
  const cwd=resolve('packages',name);
  const tests=(await readdir(join(cwd,'test'))).filter(file=>file.endsWith('.test.mjs')).map(file=>`test/${file}`);
  const child=spawn(process.execPath,['--experimental-test-coverage','--test',...tests],{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let result='';child.stdout.on('data',chunk=>result+=chunk);child.stderr.on('data',chunk=>result+=chunk);
  const code=await new Promise((done,reject)=>{child.on('error',reject);child.on('close',done);});
  await writeFile(join(output,`${name}.txt`),result);
  console.log(name,result.split('\n').filter(line=>/^# (tests|pass|fail)|all files/.test(line)).join('\n'));
  if(code!==0)process.exitCode=1;
}
console.log('V8 reports include executed test/build modules; they are not whole-project or browser coverage percentages.');
