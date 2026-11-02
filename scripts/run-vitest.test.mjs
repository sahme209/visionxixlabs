import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {once} from 'node:events';
function fixture(source,args=[]){
 const root=mkdtempSync(join(tmpdir(),'axiom-vitest-launcher-'));
 try{
  mkdirSync(join(root,'scripts'));mkdirSync(join(root,'node_modules/vitest'),{recursive:true});
  copyFileSync(new URL('./run-vitest.mjs',import.meta.url),join(root,'scripts/run-vitest.mjs'));
  writeFileSync(join(root,'node_modules/vitest/vitest.mjs'),source);
  return spawnSync(process.execPath,[join(root,'scripts/run-vitest.mjs'),...args],{encoding:'utf8'});
 }finally{rmSync(root,{recursive:true,force:true})}
}
test('forwards run and exact arguments to the actual child process',()=>{
 const result=fixture('console.log(JSON.stringify(process.argv.slice(2)))',['one test.ts','-t','literal $ value']);
 assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),['run','one test.ts','-t','literal $ value']);
});
test('preserves a failing child exit code',()=>{assert.equal(fixture('process.exit(7)').status,7)});
test('preserves child termination signal',()=>{const result=fixture("process.kill(process.pid,'SIGTERM')");assert.equal(result.signal,'SIGTERM')});
test('isolates browser tests from Node web storage when supported',()=>{
 const result=fixture("console.log(JSON.stringify({storage:'localStorage' in globalThis,flag:process.execArgv.includes('--no-experimental-webstorage')}))");
 assert.equal(result.status,0);const value=JSON.parse(result.stdout);
 if(process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')){assert.equal(value.storage,false);assert.equal(value.flag,true)}else assert.equal(value.flag,false);
});
test('keeps storage isolated in workers that clear inherited execArgv',()=>{
 const source="import {spawnSync} from 'node:child_process'; const r=spawnSync(process.execPath,['-e',\"console.log(JSON.stringify({storage:'localStorage' in globalThis}))\"],{encoding:'utf8',execArgv:[]});process.stdout.write(r.stdout);process.exitCode=r.status";
 const result=fixture(source);assert.equal(result.status,0);
 if(process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage'))assert.equal(JSON.parse(result.stdout).storage,false);
});

test('forwards a second parent signal after the child catches the first',async()=>{
 const root=mkdtempSync(join(tmpdir(),'axiom-vitest-signal-'));let launcher,childPid;
 const deadline=setTimeout(()=>launcher?.kill('SIGKILL'),4000);
 try{
  mkdirSync(join(root,'scripts'));mkdirSync(join(root,'node_modules/vitest'),{recursive:true});
  copyFileSync(new URL('./run-vitest.mjs',import.meta.url),join(root,'scripts/run-vitest.mjs'));
  writeFileSync(join(root,'node_modules/vitest/vitest.mjs'),"process.once('SIGTERM',()=>console.log('caught'));console.log(process.pid);setInterval(()=>{},1000)");
  launcher=spawn(process.execPath,[join(root,'scripts/run-vitest.mjs')],{stdio:['ignore','pipe','pipe']});
  const exited=once(launcher,'exit');
  const first=await once(launcher.stdout,'data');childPid=Number(first[0].toString().trim());assert.ok(childPid>0);
  const caught=once(launcher.stdout,'data');launcher.kill('SIGTERM');assert.equal((await caught)[0].toString().trim(),'caught');
  launcher.kill('SIGTERM');const [code,signal]=await exited;assert.equal(code,null);assert.equal(signal,'SIGTERM');
  assert.throws(()=>process.kill(childPid,0),{code:'ESRCH'});
 }finally{clearTimeout(deadline);if(childPid)try{process.kill(childPid,'SIGKILL')}catch{};launcher?.kill('SIGKILL');rmSync(root,{recursive:true,force:true})}
});
