import {mkdir, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

export async function diagnosticsDirectory(task) {
  const base=resolve(process.env.INTLUI_DIAGNOSTICS_DIR || join(tmpdir(),'intlui-core-diagnostics'));
  await mkdir(base,{recursive:true});
  return mkdtemp(join(base,`${task}-`));
}

export function chromeExecutable() {
  if(process.env.CHROME_PATH)return process.env.CHROME_PATH;
  if(process.platform==='win32')return join(process.env.PROGRAMFILES || 'C:/Program Files','Google/Chrome/Application/chrome.exe');
  if(process.platform==='darwin')return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return '/usr/bin/google-chrome';
}
