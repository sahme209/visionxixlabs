import {it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

it('negotiates actual verified loopback TLS and enforces PLUS through the installed pg Pool/parser',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'v19-pg-tls-wire-'));
 let child:ReturnType<typeof spawn>|undefined;
 const toolEnv:NodeJS.ProcessEnv={PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,TEMP:folder,TMP:folder,HOME:folder,NODE_ENV:'test'};
 const openssl=(args:string[])=>execFileSync('openssl',args,{env:toolEnv,stdio:'pipe',timeout:15000,maxBuffer:128*1024});
 try{
  writeFileSync(join(folder,'san.cnf'),'subjectAltName=DNS:localhost\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
  writeFileSync(join(folder,'wrong-san.cnf'),'subjectAltName=DNS:wrong.synthetic.invalid\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
  openssl(['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1','-keyout',join(folder,'ca.key'),'-out',join(folder,'ca.pem'),'-subj','/CN=V19 Synthetic Wire CA','-addext','basicConstraints=critical,CA:TRUE']);
  openssl(['req','-new','-newkey','rsa:2048','-nodes','-sha256','-keyout',join(folder,'server.key'),'-out',join(folder,'server.csr'),'-subj','/CN=localhost']);
  for(const [name,extension]of[['server.pem','san.cnf'],['wrong-host.pem','wrong-san.cnf']])openssl(['x509','-req','-in',join(folder,'server.csr'),'-CA',join(folder,'ca.pem'),'-CAkey',join(folder,'ca.key'),'-CAcreateserial','-out',join(folder,name),'-days','1','-sha256','-extfile',join(folder,extension)]);
  openssl(['req','-x509','-new','-key',join(folder,'server.key'),'-out',join(folder,'untrusted.pem'),'-subj','/CN=localhost','-days','1','-sha256','-addext','subjectAltName=DNS:localhost']);
  // Trust is loaded before this fresh Node process starts. Production SSL
  // options are untouched; certificate/hostname validation remains real.
  const env:NodeJS.ProcessEnv={...toolEnv,NODE_EXTRA_CA_CERTS:join(folder,'ca.pem')};
  child=spawn(process.execPath,['--experimental-strip-types',resolve('scripts/fixtures/postgres-required-binding-tls.mjs'),folder],{env,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
  let output='',errors='';let exceeded=false;
  const collect=(kind:'out'|'err',data:Buffer)=>{
   if(Buffer.byteLength(output)+Buffer.byteLength(errors)+data.length>128*1024){exceeded=true;child?.kill('SIGTERM');return}
   if(kind==='out')output+=data.toString();else errors+=data.toString();
  };
  child.stdout?.on('data',data=>collect('out',data));child.stderr?.on('data',data=>collect('err',data));
  const exit=await new Promise<number|null>((accept,reject)=>{
   const timer=setTimeout(()=>{child?.kill('SIGTERM');reject(Error('synthetic TLS wire child deadline'))},45000);
   child!.once('error',error=>{clearTimeout(timer);reject(error)});child!.once('close',code=>{clearTimeout(timer);accept(code)});
  });
  expect(exceeded).toBe(false);expect(exit,errors).toBe(0);
  const lines=output.trim().split('\n').filter(line=>line.startsWith('AXIOM_REQUIRED_BINDING_TLS:'));
  expect(lines).toHaveLength(1);
  const receipt=JSON.parse(lines[0].slice('AXIOM_REQUIRED_BINDING_TLS:'.length));
  expect(receipt).toMatchObject({syntheticOnly:true,realTls:true,realPgParser:true});
  expect(receipt.results).toHaveLength(19);
  expect(receipt.results.find((row:{mode:string})=>row.mode==='valid')).toMatchObject({connected:true,binding:true,clientProof:true,passwordCalls:1,authWrites:2,finalWrites:1,handoffs:1,queries:1});
  expect(receipt.results.find((row:{mode:string})=>row.mode==='baseline-plain')).toMatchObject({passwordCalls:1,authWrites:1,handoffs:0});
  for(const mode of ['wrong-nonce','invalid-salt','zero-iterations','excessive-iterations'])expect(receipt.results.find((row:{mode:string})=>row.mode===mode)).toMatchObject({passwordCalls:1,authWrites:1,finalWrites:0,handoffs:0,queries:0,fixedFailure:true});
  expect(output).not.toContain('untrusted-server-nonce');expect(output).not.toContain('untrusted-salt');
  expect(output).not.toContain('synthetic-wire-password');
  console.info('AXIOM_REQUIRED_BINDING_TLS_REVIEW:'+JSON.stringify(receipt));
 }finally{
  if(child&&child.exitCode===null&&child.signalCode===null){
   try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL')}catch{}
   await new Promise<void>(accept=>{if(child!.exitCode!==null||child!.signalCode!==null)accept();else child!.once('exit',()=>accept())});
  }
  rmSync(folder,{recursive:true,force:true});
 }
},120000);
