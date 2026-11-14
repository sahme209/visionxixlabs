'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createReader,FILES,PIN}=require('./reader.cjs');
const marker='\nAXIOM_HTTP_STATUS:';
test('import is dormant and exact immutable allowlist is ordered',()=>{
 assert.equal(FILES.length,4);assert(Object.isFrozen(FILES));for(const f of FILES)assert(Object.isFrozen(f));
 const r=createReader(()=>{throw Error('must not run')});assert.equal(r.state().requests,0);
 assert.equal(FILES.reduce((n,f)=>n+f[2],0),110324);
});
test('one exact anonymous bounded request; changed source stops permanently',()=>{
 let calls=0;const r=createReader((program,args,options)=>{
 calls++;assert.equal(program,'/usr/bin/curl');assert.equal(args.at(-1),'https://raw.githubusercontent.com/aws/clock-bound/'+PIN+'/'+FILES[0][0]);
 assert.equal(args[0],'--disable');assert.equal(args[args.indexOf('--proxy')+1],'');assert.equal(args[args.indexOf('--noproxy')+1],'*');
 assert.equal(args[args.indexOf('--max-redirs')+1],'0');assert.equal(args[args.indexOf('--max-time')+1],'10');
 assert.equal(options.timeout,15000);assert.equal(options.maxBuffer,262144);assert.deepEqual(options.env,{PATH:'/usr/bin:/bin'});
 assert.equal(args.some(a=>/authorization|cookie|--location/i.test(a)),false);
 return Buffer.from('wrong'+marker+'200');
 });assert.throws(()=>r.next(),/^Error: fixed_public_source_unavailable$/);assert.throws(()=>r.next());assert.equal(calls,1);assert.equal(r.state().stopped,true);
});
test('status, overflow, invalid UTF8 and transport errors do not leak and cannot retry',()=>{
 for(const value of [Buffer.from('no'+marker+'302'),Buffer.alloc(262145),Buffer.from([255]),'not a buffer',null]){
  let n=0;const r=createReader(()=>{n++;return value});assert.throws(()=>r.next(),/^Error: fixed_public_source_unavailable$/);assert.throws(()=>r.next());assert.equal(n,1);
 }
 let n=0;const r=createReader(()=>{n++;throw Error('UNSAFE RAW ERROR')});assert.throws(()=>r.next(),/^Error: fixed_public_source_unavailable$/);assert.throws(()=>r.next());assert.equal(n,1);
});
function syntheticReader(){
 const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync(__dirname+'/reader.cjs','utf8');let hashIndex=0;const packets=[];
 const sandbox={Buffer,module:{exports:{}},require(name){if(name==='node:crypto')return {createHash(algorithm){assert.equal(algorithm,'sha1');let part=0;const h={update(value){assert(Buffer.isBuffer(value));if(part++===0)assert.equal(value.toString(),'blob '+FILES[hashIndex][2]+'\0');else assert.equal(value.length,FILES[hashIndex][2]);return h},digest(format){assert.equal(format,'hex');return FILES[hashIndex++][1]}};return h}};return require(name)}};
 vm.runInNewContext(source,sandbox);const r=sandbox.module.exports.createReader((program,args)=>{const i=packets.length;packets.push(args.at(-1));return Buffer.concat([Buffer.alloc(FILES[i][2],65),Buffer.from(marker+'200')])});return {r,packets};
}
test('synthetic hash adapter exercises exact four-file order and exhausted pass without fifth request',()=>{
 const {r,packets}=syntheticReader();for(const f of FILES){const value=r.next();assert.equal(value.path,f[0]);assert.equal(value.sha1,f[1]);assert.equal(value.bytes,f[2])}
 assert.equal(r.state().complete,true);assert.equal(r.state().requests,4);assert.deepEqual(packets,FILES.map(f=>'https://raw.githubusercontent.com/aws/clock-bound/'+PIN+'/'+f[0]));
 assert.throws(()=>r.next());assert.equal(packets.length,4);assert.equal(r.state().stopped,true);
});
