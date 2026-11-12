import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {observeIsolatedNextStartup as read} from '../report-isolated-next-startup.mjs';
test('fixed-category reader refuses links and reports only labels for an owned regular file',()=>{
 const dir=mkdtempSync(join(tmpdir(),'axiom-startup-reader-'));try{
  const file=join(dir,'owned');writeFileSync(file,'ERR_MODULE_NOT_FOUND PRIVATE_SECRET',{mode:0o600});assert.deepEqual(read(file),{status:'observed',categories:['module_missing']});
  const link=join(dir,'link');symlinkSync(file,link);assert.deepEqual(read(link),{status:'unavailable',categories:[]});
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('a FIFO cannot block the reader before the regular-file check',()=>{
 const dir=mkdtempSync(join(tmpdir(),'axiom-startup-fifo-'));try{
  const fifo=join(dir,'pipe'),made=spawnSync('mkfifo',[fifo],{timeout:2000});assert.equal(made.status,0);
  const entry=pathToFileURL(resolve('scripts/report-isolated-next-startup.mjs')).href;
  const result=spawnSync(process.execPath,['--input-type=module','-e',`import {observeIsolatedNextStartup as read} from ${JSON.stringify(entry)};console.log(JSON.stringify(read(${JSON.stringify(fifo)})));`],{timeout:2000,encoding:'utf8',maxBuffer:65536});
  assert.equal(result.error,undefined);assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),{status:'unavailable',categories:[]});
 }finally{rmSync(dir,{recursive:true,force:true})}
});
