'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {createReader,PIN}=require('./reader.cjs');
const tree='a'.repeat(40),commitURL='https://api.github.com/repos/aws/clock-bound/git/commits/'+PIN,treeURL='https://api.github.com/repos/aws/clock-bound/git/trees/'+tree+'?recursive=1';
const response=text=>Buffer.from(text+'\nAXIOM_HTTP_STATUS:200');
function fixture(){
 const bodies={'README.md':'Public documentation','Cargo.toml':'[workspace]','client/lib.rs':'pub fn now() {}','client/read.rs':'reader','client/error.rs':'error','LICENSE':'License'};
 const entries=Object.entries(bodies).map(([path,body])=>({path,type:'blob',mode:'100644',size:Buffer.byteLength(body),sha:createHash('sha1').update('blob '+Buffer.byteLength(body)+'\0'+body).digest('hex')}));
 const replies=new Map([[commitURL,JSON.stringify({sha:PIN,tree:{sha:tree}})],[treeURL,JSON.stringify({sha:tree,truncated:false,tree:entries})],...Object.entries(bodies).map(([p,b])=>['https://raw.githubusercontent.com/aws/clock-bound/'+PIN+'/'+p,b])]);
 const calls=[],reader=createReader((program,args,options)=>{calls.push({program,args,options});const body=replies.get(args.at(-1));assert.notEqual(body,undefined);return response(body)});
 return {reader,calls,replies,entries};
}
test('uses exact dependency order, pinned URLs, bounded anonymous transport and Git blob verification',()=>{
 const f=fixture();f.reader.commit();f.reader.tree();assert.equal(f.reader.file('client/lib.rs').body,'pub fn now() {}');assert.equal(f.reader.state().requests,3);
 for(const call of f.calls){assert.equal(call.program,'/usr/bin/curl');assert.equal(call.args[0],'--disable');assert.equal(call.args[call.args.indexOf('--proxy')+1],'');assert.equal(call.args[call.args.indexOf('--max-redirs')+1],'0');assert.equal(call.args[call.args.indexOf('--max-time')+1],'10');assert.equal(call.options.timeout,15000);assert.deepEqual(call.options.env,{PATH:'/usr/bin:/bin'});assert.equal(call.args.some(a=>/authorization|cookie|--location/i.test(a)),false)}
});
test('wrong commit permanently stops without another transport attempt',()=>{const f=fixture();f.replies.set(commitURL,JSON.stringify({sha:'b'.repeat(40),tree:{sha:tree}}));assert.throws(()=>f.reader.commit());assert.throws(()=>f.reader.commit());assert.equal(f.calls.length,1);assert.equal(f.reader.state().stopped,true)});
test('truncated or contradictory tree cannot authorize any source file',()=>{for(const change of [{truncated:true},{sha:'b'.repeat(40)}]){const f=fixture();f.reader.commit();f.replies.set(treeURL,JSON.stringify({sha:tree,truncated:false,tree:f.entries,...change}));assert.throws(()=>f.reader.tree());assert.throws(()=>f.reader.file('README.md'));assert.equal(f.calls.length,2)}});
test('changed source bytes fail blob proof and stop without retry',()=>{const f=fixture();f.reader.commit();f.reader.tree();f.replies.set('https://raw.githubusercontent.com/aws/clock-bound/'+PIN+'/README.md','Changed');assert.throws(()=>f.reader.file('README.md'));assert.throws(()=>f.reader.file('README.md'));assert.equal(f.calls.length,3)});
test('out-of-order, absent, traversing and symlink paths never issue a source request',()=>{
 const first=fixture();assert.throws(()=>first.reader.file('README.md'));assert.equal(first.calls.length,0);
 for(const path of ['missing.rs','../README.md','README.md?token=x']){const f=fixture();f.reader.commit();f.reader.tree();assert.throws(()=>f.reader.file(path));assert.equal(f.calls.length,2)}
 const f=fixture();f.reader.commit();f.entries[0].mode='120000';f.replies.set(treeURL,JSON.stringify({sha:tree,truncated:false,tree:f.entries}));f.reader.tree();assert.throws(()=>f.reader.file('README.md'));assert.equal(f.calls.length,2);
});
test('at most eight calls and six distinct files; consumed pass never retries',()=>{const f=fixture();f.reader.commit();f.reader.tree();for(const entry of f.entries)f.reader.file(entry.path);assert.equal(f.calls.length,8);assert.throws(()=>f.reader.file('README.md'));assert.equal(f.calls.length,8);assert.equal(f.reader.state().stopped,true)});
test('HTTP refusal, output overflow and invalid UTF-8 stop without leaking native errors',()=>{
 for(const value of [Buffer.from('refused\nAXIOM_HTTP_STATUS:403'),Buffer.alloc(256*1024+1),Buffer.from([255])]){let calls=0;const r=createReader(()=>{calls++;return value});assert.throws(()=>r.commit(),/^Error: pinned_public_source_unavailable$/);assert.throws(()=>r.commit());assert.equal(calls,1)}
 let calls=0;const r=createReader(()=>{calls++;throw Error('PRIVATE SHOULD NOT ESCAPE')});assert.throws(()=>r.commit(),/^Error: pinned_public_source_unavailable$/);assert.equal(calls,1);
});
