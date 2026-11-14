'use strict';
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {TextDecoder}=require('node:util');
const PIN='371058f8f6a1786d4a4ab3eed9f5f2f16eea7777',MAX=256*1024,MARKER='\nAXIOM_HTTP_STATUS:',HEX=/^[a-f0-9]{40}$/;
const fail=()=>{throw Error('pinned_public_source_unavailable')};
/** Dormant public-text reader; no invocation on import. Fresh owner permission
 * must precede the ONE finite pass. A successful read is not client adoption. */
function createReader(run=execFileSync){
 let count=0,stopped=false,tree=null,entries=null;const selected=new Set();
 function guard(){if(stopped||count>=8)fail()}
 function request(url){
  guard();count++;
  const args=['--disable','--proxy','','--noproxy','*','--proto','=https','--proto-redir','=https','--max-redirs','0','--connect-timeout','5','--max-time','10','--max-filesize',String(MAX),'--fail','--silent','--show-error','--write-out',MARKER+'%{http_code}','--url',url];
  const output=run('/usr/bin/curl',args,{timeout:15000,killSignal:'SIGKILL',maxBuffer:MAX,encoding:'buffer',env:{PATH:'/usr/bin:/bin'},stdio:['ignore','pipe','pipe']});
  if(!Buffer.isBuffer(output)||output.length>MAX)fail();
  const text=new TextDecoder('utf-8',{fatal:true}).decode(output),end=text.lastIndexOf(MARKER);
  if(end<0||text.slice(end+MARKER.length)!=='200')fail();return text.slice(0,end);
 }
 function perform(fn){try{guard();return fn()}catch{stopped=true;return fail()}}
 return Object.freeze({
  commit(){return perform(()=>{if(tree!==null)fail();const url='https://api.github.com/repos/aws/clock-bound/git/commits/'+PIN,body=request(url),value=JSON.parse(body);if(value.sha!==PIN||!HEX.test(value.tree?.sha))fail();tree=value.tree.sha;return Object.freeze({url,body})})},
  tree(){return perform(()=>{if(tree===null||entries!==null)fail();const url='https://api.github.com/repos/aws/clock-bound/git/trees/'+tree+'?recursive=1',body=request(url),value=JSON.parse(body);if(value.sha!==tree||value.truncated!==false||!Array.isArray(value.tree))fail();
   entries=new Map();for(const entry of value.tree){if(typeof entry.path!=='string'||entries.has(entry.path))fail();entries.set(entry.path,Object.freeze({...entry}))}return Object.freeze({url,body})})},
  file(path){return perform(()=>{if(!entries||typeof path!=='string'||selected.size>=6||selected.has(path)||!path.split('/').every(p=>/^[A-Za-z0-9_.-]+$/.test(p)&&p!=='.'&&p!=='..')||!/(?:^|\/)(?:README\.md|Cargo\.toml|[A-Za-z0-9_-]+\.rs|LICENSE[A-Za-z0-9_.-]*|NOTICE[A-Za-z0-9_.-]*)$/.test(path))fail();
   const entry=entries.get(path);if(!entry||entry.type!=='blob'||!['100644','100755'].includes(entry.mode)||!HEX.test(entry.sha)||!Number.isSafeInteger(entry.size)||entry.size<0||entry.size>MAX)fail();selected.add(path);
   const url='https://raw.githubusercontent.com/aws/clock-bound/'+PIN+'/'+path,body=request(url),bytes=Buffer.from(body,'utf8'),actual=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');if(bytes.length!==entry.size||actual!==entry.sha)fail();return Object.freeze({url,path,body,sha1:actual,bytes:bytes.length})})},
  state(){return Object.freeze({requests:count,files:selected.size,stopped,commit:PIN,tree})},
 });
}
module.exports={createReader,PIN};
