'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{readPublicSource}=require('./reader.cjs');
const url='https://api.github.com/repos/aws/clock-bound/releases?per_page=10';
test('one fixed request has bounded output/time, HTTPS, no redirects/config/proxy/auth and no private environment',()=>{
 let calls=0;const result=readPublicSource(url,(file,args,options)=>{calls++;assert.equal(file,'/usr/bin/curl');assert.equal(args[0],'--disable');for(const [key,value]of [['--proxy',''],['--noproxy','*'],['--proto','=https'],['--proto-redir','=https'],['--max-redirs','0'],['--connect-timeout','5'],['--max-time','10'],['--max-filesize','262144'],['--url',url]])assert.equal(args[args.indexOf(key)+1],value);assert(!args.includes('-L'));assert(!args.includes('--location'));assert.deepEqual(options.env,{PATH:'/usr/bin:/bin'});assert.equal(options.timeout,15000);assert.equal(options.maxBuffer,262144);assert.equal(options.killSignal,'SIGKILL');assert.equal(options.stdio[0],'ignore');return Buffer.from('[]\nAXIOM_HTTP_STATUS:200')});assert.equal(calls,1);assert.equal(result.body,'[]');assert.equal(result.bodyBytes,2);assert(Object.isFrozen(result));
});
test('all rejected statuses, oversized/invalid data and process failures stop once with a fixed error',()=>{
 for(const output of [Buffer.from('x\nAXIOM_HTTP_STATUS:302'),Buffer.from('x\nAXIOM_HTTP_STATUS:404'),Buffer.from('x'),Buffer.alloc(262145),Buffer.from([255]),null]){let calls=0;assert.throws(()=>readPublicSource(url,()=>{calls++;return output}),/^Error: public_source_read_unavailable$/);assert.equal(calls,1)}
 let calls=0;assert.throws(()=>readPublicSource(url,()=>{calls++;throw Error('untrusted raw diagnostic')}),/^Error: public_source_read_unavailable$/);assert.equal(calls,1);
});
test('rejects out-of-scope/auth/HTTP/redirect-fragment and guessed API routes before I/O',()=>{
 let calls=0;for(const value of ['http://api.github.com/repos/aws/clock-bound/releases?per_page=10','https://user:password@api.github.com/repos/aws/clock-bound/releases?per_page=10',url+'#fragment','https://api.github.com/repos/aws/clock-bound/contents','https://example.test/','https://raw.githubusercontent.com/aws/clock-bound/main/Cargo.toml'])assert.throws(()=>readPublicSource(value,()=>{calls++;return Buffer.from('')}));assert.equal(calls,0);
});
