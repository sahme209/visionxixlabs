'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readPublicSource}=require('./reader.cjs');
const tags='https://api.github.com/repos/aws/clock-bound/tags?per_page=100',sha='a'.repeat(40),suffix='\nAXIOM_HTTP_STATUS:200';
test('new exact public tags endpoint is one bounded credential-free request',()=>{
 let calls=0;const result=readPublicSource(tags,(cmd,args,options)=>{calls++;assert.equal(cmd,'/usr/bin/curl');assert.equal(args[0],'--disable');assert.equal(args[args.length-1],tags);assert.equal(args[args.indexOf('--max-redirs')+1],'0');assert.equal(args[args.indexOf('--max-time')+1],'10');assert.equal(args[args.indexOf('--max-filesize')+1],String(256*1024));assert.equal(options.timeout,15000);assert.equal(options.killSignal,'SIGKILL');assert.deepEqual(options.env,{PATH:'/usr/bin:/bin'});assert(!args.includes('--retry'));assert(!args.includes('--location'));return Buffer.from('[]'+suffix)});assert.equal(calls,1);assert.equal(result.body,'[]');
});
test('only pinned tree and text source coordinates pass',()=>{
 for(const url of ['https://api.github.com/repos/aws/clock-bound/git/trees/'+sha+'?recursive=1','https://raw.githubusercontent.com/aws/clock-bound/'+sha+'/clock-bound-client/Cargo.toml','https://raw.githubusercontent.com/aws/clock-bound/'+sha+'/clock-bound-client/src/lib.rs'])assert.equal(readPublicSource(url,()=>Buffer.from('{}'+suffix)).body,'{}');
});
test('old release reads, floating code, foreign hosts and normalization are refused before any request',()=>{
 for(const url of ['https://api.github.com/repos/aws/clock-bound/releases?per_page=10','https://api.github.com/repos/aws/clock-bound/commits/main','https://raw.githubusercontent.com/aws/clock-bound/main/Cargo.toml','https://example.test/Cargo.toml','http://api.github.com/repos/aws/clock-bound/tags?per_page=100',tags+'#fragment','https://user:password@api.github.com/repos/aws/clock-bound/tags?per_page=100','https://raw.githubusercontent.com/aws/clock-bound/'+sha+'/x/../Cargo.toml','https://raw.githubusercontent.com/aws/clock-bound/'+sha+'/binary.node']){let called=false;assert.throws(()=>readPublicSource(url,()=>{called=true;return Buffer.from('{}'+suffix)}),/unavailable/);assert.equal(called,false)}
});
test('failure is one request with no fallback or retry',()=>{let calls=0;assert.throws(()=>readPublicSource(tags,()=>{calls++;throw Error('synthetic unavailable')}),/unavailable/);assert.equal(calls,1)});
test('oversized, invalid UTF8, absent status and redirects refuse',()=>{
 for(const data of [Buffer.alloc(256*1024+1),Buffer.from([0xff]),Buffer.from('{}'),Buffer.from('{}\nAXIOM_HTTP_STATUS:302')])assert.throws(()=>readPublicSource(tags,()=>data),/unavailable/);
});
