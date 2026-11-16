// Actual loopback TLS + PostgreSQL protocol fixture. Synthetic credentials only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import {createHash,createHmac,pbkdf2Sync,timingSafeEqual,X509Certificate} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Client,Pool}=require('pg');
// In-memory test compilation matches ordinary TS execution while retaining
// real installed pg/TLS. No generated source or dependency mutation.
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>{
 const source=readFileSync(filename,'utf8');
 const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 module._compile(result.outputText,filename);
};
const {postgresConnectionOptions}=require('../../lib/database/postgresConnectionPolicy.ts');
const {directNeonSessionOptions}=require('../../lib/database/directNeonSession.ts');
const folder=process.argv[2];
const password='synthetic-wire-password';
const cert=readFileSync(`${folder}/server.pem`),key=readFileSync(`${folder}/server.key`);
const int=value=>{const out=Buffer.alloc(4);out.writeInt32BE(value);return out};
const frame=(tag,bytes=Buffer.alloc(0))=>Buffer.concat([Buffer.from(tag),int(bytes.length+4),bytes]);
const auth=(code,bytes=Buffer.alloc(0))=>frame('R',Buffer.concat([int(code),bytes]));
const ready=()=>frame('Z',Buffer.from('I'));
const offer=(plus=true)=>auth(10,Buffer.from(plus?'SCRAM-SHA-256-PLUS\0SCRAM-SHA-256\0\0':'SCRAM-SHA-256\0\0'));
const sha=bytes=>createHash('sha256').update(bytes).digest();
const hmac=(key,value)=>createHmac('sha256',key).update(value).digest();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bounded=(promise,ms,label)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms)})]).finally(()=>clearTimeout(timer))};
async function scenario(mode){
 const count={mode,passwordCalls:0,authWrites:0,finalWrites:0,handoffs:0,queries:0,clientProof:false,binding:false,connected:false};
 const sockets=new Set();let serverFailure;
 const useCert=mode==='wrong-host'?readFileSync(`${folder}/wrong-host.pem`):mode==='untrusted-ca'?readFileSync(`${folder}/untrusted.pem`):cert;
 const context=tls.createSecureContext({cert:useCert,key});
 const server=net.createServer(raw=>{
  sockets.add(raw);raw.on('error',()=>{});raw.on('close',()=>sockets.delete(raw));
  let ssl=Buffer.alloc(0);
  const onRequest=bytes=>{
   ssl=Buffer.concat([ssl,bytes]);if(ssl.length<8)return;
   raw.removeListener('data',onRequest);
   try{assert.equal(ssl.length,8);assert.equal(ssl.readInt32BE(0),8);assert.equal(ssl.readInt32BE(4),80877103)}catch(error){serverFailure=error;raw.destroy();return}
   raw.write('S');
   const stream=new tls.TLSSocket(raw,{isServer:true,secureContext:context});
   sockets.add(stream);stream.on('error',()=>{});stream.on('close',()=>sockets.delete(stream));
   let buffer=Buffer.alloc(0),startup=true,clientFirstBare,serverFirst,gs2;
   const salt=Buffer.from('synthetic-wire-salt'),iterations=4096;
   const onFrame=(tag,payload)=>{
    if(startup){
     startup=false;assert.equal(payload.readInt32BE(0),196608);
     if(mode==='cleartext')stream.write(auth(3));
     else if(mode==='md5')stream.write(auth(5,Buffer.from([1,2,3,4])));
     else if(mode==='trust')stream.write(Buffer.concat([auth(0),ready()]));
     else if(mode==='early-ready'||mode==='no-auth')stream.write(ready());
     else if(mode==='plain'||mode==='baseline-plain')stream.write(offer(false));
     else stream.write(offer());
     return;
    }
    if(tag==='p'){
     count.authWrites++;
     if(mode==='baseline-plain'){stream.destroy();return}
     if(!clientFirstBare){
      const zero=payload.indexOf(0);assert.equal(payload.subarray(0,zero).toString(),'SCRAM-SHA-256-PLUS');
      const first=payload.subarray(zero+5).toString();assert.equal(payload.readInt32BE(zero+1),Buffer.byteLength(first));
      gs2='p=tls-server-end-point,,';assert.ok(first.startsWith(gs2));clientFirstBare=first.slice(gs2.length);
      const nonce=clientFirstBare.match(/(?:^|,)r=([^,]+)$/)[1];
      serverFirst=`r=${nonce}synthetic-server,s=${salt.toString('base64')},i=${iterations}`;
      // Mutate only the challenge. No premature Ready/AuthOk competes with
      // the installed SASL parser's own refusal or wrapper sanitization.
      if(mode==='wrong-nonce')serverFirst=`r=untrusted-server-nonce,s=${salt.toString('base64')},i=${iterations}`;
      if(mode==='invalid-salt')serverFirst=`r=${nonce}synthetic-server,s=***untrusted-salt***,i=${iterations}`;
      if(mode==='zero-iterations')serverFirst=`r=${nonce}synthetic-server,s=${salt.toString('base64')},i=0`;
      if(mode==='excessive-iterations')serverFirst=`r=${nonce}synthetic-server,s=${salt.toString('base64')},i=100001`;
      const continuation=auth(11,Buffer.from(serverFirst));
      if(mode==='late-proof')stream.write(Buffer.concat([continuation,ready()]));
      else stream.write(continuation);
     }else{
      count.finalWrites++;
      const final=payload.toString(),withoutProof=final.slice(0,final.lastIndexOf(',p='));
      const fields=Object.fromEntries(final.split(',').map(field=>[field.slice(0,1),field.slice(2)]));
      const certificateHash=sha(new X509Certificate(useCert).raw);
      assert.equal(fields.c,Buffer.concat([Buffer.from(gs2),certificateHash]).toString('base64'));count.binding=true;
      const authMessage=`${clientFirstBare},${serverFirst},${withoutProof}`;
      const salted=pbkdf2Sync(password,salt,iterations,32,'sha256');
      const clientKey=hmac(salted,'Client Key'),signature=hmac(sha(clientKey),authMessage);
      const expected=Buffer.from(clientKey.map((value,index)=>value^signature[index]));
      assert.ok(timingSafeEqual(Buffer.from(fields.p,'base64'),expected));count.clientProof=true;
      const serverProof=mode==='bad-server-proof'?Buffer.alloc(32,0):hmac(hmac(salted,'Server Key'),authMessage);
      stream.write(Buffer.concat([auth(12,Buffer.from(`v=${serverProof.toString('base64')}`)),auth(0),ready()]));
     }
    }else if(tag==='Q'){
     count.queries++;
     // Protocol-only acknowledgment; no SQL engine or provider is used.
     stream.write(Buffer.concat([frame('C',Buffer.from('SELECT 0\0')),ready()]));
    }else if(tag==='X'){stream.end()}
    else throw Error('unexpected synthetic client message');
   };
   stream.on('data',bytes=>{
    try{
     buffer=Buffer.concat([buffer,bytes]);assert.ok(buffer.length<65536);
     while(true){
      if(startup){if(buffer.length<4)return;const size=buffer.readInt32BE(0);assert.ok(size>=8&&size<65536);if(buffer.length<size)return;const payload=buffer.subarray(4,size);buffer=buffer.subarray(size);onFrame('',payload)}
      else{if(buffer.length<5)return;const size=buffer.readInt32BE(1);assert.ok(size>=4&&size<65536);if(buffer.length<size+1)return;const tag=buffer.subarray(0,1).toString(),payload=buffer.subarray(5,size+1);buffer=buffer.subarray(size+1);onFrame(tag,payload)}
     }
    }catch(error){serverFailure=error;stream.destroy()}
   });
  };raw.on('data',onRequest);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'localhost',resolve)});
 const address=server.address();assert.ok(['127.0.0.1','::1'].includes(address.address));
 const options=postgresConnectionOptions(`postgresql://synthetic:synthetic@localhost:${address.port}/synthetic?sslmode=require&channel_binding=${mode==='baseline-plain'?'prefer':'require'}&connect_timeout=1`);
 if(mode==='timeout-late-password')options.connectionTimeoutMillis=50;
 const originalSsl=JSON.stringify(options.ssl);
 options.password=()=>{count.passwordCalls++;return mode.includes('late-password')?delay(150).then(()=>password):password};
 const config=directNeonSessionOptions(options);
 if(mode!=='baseline-plain')assert.ok(config.Client&&config.Client!==Client,'strict factory must compose actual pg config');
 assert.equal(JSON.stringify(config.ssl),originalSsl);assert.equal(config.host,'localhost');
 const pool=new Pool({...config,max:1,onConnect(){count.handoffs++}});
 pool.on('error',()=>{});
 let client,connectionError;
 try{
  if(mode==='late-password'||mode==='close-late-password'){
   const interval=setInterval(()=>{
    if(count.passwordCalls){clearInterval(interval);for(const socket of sockets)if(socket instanceof tls.TLSSocket){if(mode==='close-late-password')socket.destroy();else socket.write(auth(0))}}
   },2);setTimeout(()=>clearInterval(interval),500).unref();
  }
  try{
   client=await bounded(pool.connect(),1800,'synthetic handshake deadline');count.connected=true;
   await bounded(client.query('SELECT 1 AS synthetic'),1000,'synthetic query deadline');
  }catch(error){connectionError=error}
  await delay(200);
  if(serverFailure)throw serverFailure;
  if(mode==='valid'){
   assert.equal(count.connected,true);assert.equal(count.passwordCalls,1);assert.equal(count.authWrites,2);assert.equal(count.finalWrites,1);assert.equal(count.handoffs,1);assert.equal(count.queries,1);assert.ok(count.binding&&count.clientProof);
  }else if(mode==='baseline-plain'){
   assert.equal(count.passwordCalls,1);assert.equal(count.authWrites,1);assert.equal(count.handoffs,0);
  }else{
   assert.equal(count.connected,false);assert.equal(count.handoffs,0);assert.equal(count.queries,0);
   if(['wrong-nonce','invalid-salt','zero-iterations','excessive-iterations'].includes(mode)){
    assert.equal(count.passwordCalls,1);assert.equal(count.authWrites,1);assert.equal(count.finalWrites,0);
    assert.equal(connectionError?.message,'postgres_channel_binding_required_unavailable');
    count.fixedFailure=true;
   }
   else if(mode==='late-proof'){assert.equal(count.passwordCalls,1);assert.equal(count.authWrites,1);assert.equal(count.finalWrites,0)}
   else if(mode.includes('late-password')){assert.equal(count.passwordCalls,1);assert.equal(count.authWrites,0)}
   else if(mode==='bad-server-proof'){assert.equal(count.passwordCalls,1);assert.equal(count.finalWrites,1);assert.ok(count.clientProof)}
   else{assert.equal(count.passwordCalls,0);assert.equal(count.authWrites,0)}
  }
  return count;
 }finally{
  if(client)client.release(true);
  for(const socket of sockets)socket.destroy();
  await bounded(pool.end(),1000,'synthetic pool cleanup deadline');
  await bounded(new Promise(resolve=>server.close(resolve)),1000,'synthetic server cleanup deadline');
 }
}
const results=[];
for(const mode of ['baseline-plain','valid','plain','cleartext','md5','trust','no-auth','early-ready','wrong-host','untrusted-ca','bad-server-proof','late-password','timeout-late-password','close-late-password','late-proof','wrong-nonce','invalid-salt','zero-iterations','excessive-iterations'])results.push(await scenario(mode));
console.log('AXIOM_REQUIRED_BINDING_TLS:'+JSON.stringify({syntheticOnly:true,realTls:true,realPgParser:true,results}));
