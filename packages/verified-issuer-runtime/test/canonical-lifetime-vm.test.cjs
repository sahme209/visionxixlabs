'use strict';
// Source-unit VM only. Native, package, process and compiled initializer are
// simulated. This is not actual canonical/native/compiled-consumer qualification.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../index.cjs'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function load(){
 const root='/synthetic',entry=root+'/node_modules/@axiom/verified-issuer-runtime/index.cjs',addon=root+'/node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node';
 const state={origin:true,request:true,originReads:0,requestReads:0,closed:0,nativeClosed:0,drains:[],replies:[],dispatches:[],errors:[],finish:null};let take;
 const native=Object.freeze({
  assertCurrentOrigin:Object.freeze(()=>{state.originReads++;if(!state.origin)throw Error('origin lost')}),
  consumeBootstrapResources:Object.freeze(()=>Object.freeze({datasource:'synthetic',vaultKey:new Uint8Array(32),sessionSigningKey:new Uint8Array(32)})),
  nextRequestEvent:Object.freeze(()=>new Promise(resolve=>{take=resolve})),
  completeRequest:Object.freeze((id,bytes)=>{if(!state.request){if(Buffer.from(bytes).readUInt32BE(0)!==503)throw Error('request terminal');state.drains.push(id);return;}state.replies.push({id,bytes})}),
  assertRequestCurrent:Object.freeze(()=>{state.requestReads++;if(!state.request)throw Error('request terminal')}),
  closeRuntime:Object.freeze(()=>{state.nativeClosed++}),
 });
 const module={parent:null,id:'.',filename:entry,exports:{}};
 function require(name){
  if(name==='node:fs')return {realpathSync:x=>x};
  if(name==='node:path')return path;
  if(name==='node:worker_threads')return {isMainThread:true};
  if(name.endsWith('/internal/verify-package.cjs'))return {verifyPackageFiles:()=>({qualification:'package_file_set_verified',packageDigest:'a'.repeat(64)})};
  if(name===addon){require.cache[addon]={exports:native};return native;}
  if(name.endsWith('/release-merge-bootstrap.cjs'))return {initializePrivateReleaseMergeBootstrap:async()=>Object.freeze({close:async()=>{state.closed++},dispatch:async(bytes,signal)=>{state.dispatches.push({bytes,signal});return new Promise(resolve=>{state.finish=()=>resolve({status:200,body:new Uint8Array([123,125])})})}})};
  throw Error('unexpected import '+name);
 }
 require.main=module;require.cache={[entry]:module};
 const process={execArgv:[],argv:[root+'/__axiom_runtime__/node',entry],execPath:root+'/__axiom_runtime__/node',env:{NODE_ENV:'production'},cwd:()=>root,stderr:{write:x=>state.errors.push(x)},exitCode:undefined};
 vm.runInNewContext(source,{require,module,__filename:entry,process,Buffer,Uint8Array,Object,Reflect,Promise,Error,AbortController,AbortSignal});
 return {state,reader:module.exports.readIssuerIdentity,emit:event=>{assert.ok(take,'native event wait exists');const resolve=take;take=null;resolve(event)},swapNative:()=>{require.cache[addon]={exports:{}}}};
}
test('simulated canonical startup establishes live identity but never claims qualification or action permission',async()=>{
 const f=load();await tick();const value=f.reader();assert.equal(value.status,'current');assert.equal(value.issuerArtifactDigest,'a'.repeat(64));assert.equal(value.executionAuthorized,false);assert.equal(value.runtimeQualification,'unavailable');assert.equal(value.fleetQualification,'unavailable');const before=f.state.originReads;f.reader();assert.ok(f.state.originReads>before);assert.equal(f.state.closed,0);
});
test('actual source reader permanently revokes simulated origin/cache loss',async()=>{
 for(const mode of ['origin','cache']){const f=load();await tick();assert.equal(f.reader().status,'current');if(mode==='origin')f.state.origin=false;else f.swapNative();assert.equal(f.reader().status,'unavailable');f.state.origin=true;assert.equal(f.reader().status,'unavailable');await tick();assert.equal(f.state.closed,1);assert.equal(f.state.nativeClosed,1);}
});
test('one simulated native request binds fresh request checks and returns framed reply',async()=>{
 const f=load();await tick();const id='b'.repeat(64);f.emit({kind:'request',id,bytes:new Uint8Array([1])});await tick();assert.equal(f.state.dispatches.length,1);assert.equal(f.reader().status,'current');assert.ok(f.state.requestReads>0);f.state.finish();await tick();assert.equal(f.state.replies.length,1);const frame=f.state.replies[0].bytes;assert.equal(Buffer.from(frame).readUInt32BE(0),200);assert.equal(Buffer.from(frame).readUInt32BE(4),2);
});
test('broker-terminal simulated request refuses before child cancellation event without revoking origin',async()=>{
 const f=load();await tick();const id='b'.repeat(64);f.emit({kind:'request',id,bytes:new Uint8Array([1])});await tick();f.state.request=false;assert.equal(f.reader().status,'unavailable');assert.equal(f.state.origin,true);f.emit({kind:'cancel',id});await tick();assert.equal(f.state.dispatches[0].signal.aborted,true);f.state.finish();await tick();assert.equal(f.state.replies.length,0);assert.equal(f.reader().status,'current');assert.equal(f.state.closed,0);
});
test('late cancellation of a drained request does not close the healthy epoch',async()=>{
 const f=load();await tick();const id='b'.repeat(64);f.emit({kind:'request',id,bytes:new Uint8Array([1])});await tick();f.state.finish();await tick();f.emit({kind:'cancel',id});await tick();assert.equal(f.reader().status,'current');assert.equal(f.state.closed,0);
});

test('cancelled work drains its exact native slot before a distinct new request',async()=>{
 const f=load();await tick();const first='b'.repeat(64);f.emit({kind:'request',id:first,bytes:new Uint8Array([1])});await tick();f.state.request=false;f.emit({kind:'cancel',id:first});await tick();f.state.finish();await tick();assert.deepEqual(f.state.drains,[first]);assert.equal(f.state.replies.length,0);f.state.request=true;f.emit({kind:'request',id:'c'.repeat(64),bytes:new Uint8Array([2])});await tick();assert.equal(f.state.dispatches.length,2);f.state.finish();await tick();assert.equal(f.state.replies.length,1);
});
