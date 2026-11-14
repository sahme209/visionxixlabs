'use strict';
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {TextDecoder}=require('node:util');
const PIN='371058f8f6a1786d4a4ab3eed9f5f2f16eea7777',MAX=256*1024,MARKER='\nAXIOM_HTTP_STATUS:';
const FILES=Object.freeze([
 ['clock-bound/src/shm/shm_header.rs','02392ad46608739f0e42de99bef019c0663b1a35',11388],
 ['clock-bound/src/shm/writer.rs','fae6b1c1a9e4bb386e09248c409c811318e59e71',31430],
 ['clock-bound/src/daemon/clock_state/shm_writer.rs','1bf2e2c54d5963a1878bed75446efdc06930d1e8',1411],
 ['clock-bound/src/daemon/clock_state/shm_writer/shm0.rs','7a16ca5ebbe42f5b4754ad80e24c90327c99e303',13511],
 ['clock-bound/src/daemon/clock_state/shm_writer/shm1.rs','8dba8a36fb082f08504b5ba8851ea5bdb3e8dc95',10094]
].map(Object.freeze));
const fail=()=>{throw Error('fixed_public_source_unavailable')};
/** Dormant on import. ONE instance/pass after owner approval and review. */
function createReader(run=execFileSync){
 let count=0,stopped=false;
 function guard(){if(stopped||count>=FILES.length)fail()}
 function request(url){
  guard();count++;
  const args=['--disable','--proxy','','--noproxy','*','--proto','=https','--proto-redir','=https','--max-redirs','0','--connect-timeout','5','--max-time','10','--max-filesize',String(MAX),'--fail','--silent','--show-error','--write-out',MARKER+'%{http_code}','--url',url];
  const output=run('/usr/bin/curl',args,{timeout:15000,killSignal:'SIGKILL',maxBuffer:MAX,encoding:'buffer',env:{PATH:'/usr/bin:/bin'},stdio:['ignore','pipe','pipe']});
  if(!Buffer.isBuffer(output)||output.length>MAX)fail();
  const text=new TextDecoder('utf-8',{fatal:true}).decode(output),end=text.lastIndexOf(MARKER);
  if(end<0||text.slice(end+MARKER.length)!=='200')fail();return text.slice(0,end);
 }
 return Object.freeze({
  next(){try{
   guard();const [path,sha,size]=FILES[count];
   const url='https://raw.githubusercontent.com/aws/clock-bound/'+PIN+'/'+path;
   const body=request(url),bytes=Buffer.from(body,'utf8');
   const actual=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
   if(bytes.length!==size||actual!==sha)fail();
   return Object.freeze({url,path,body,sha1:actual,bytes:bytes.length});
  }catch{stopped=true;return fail()}},
  state(){return Object.freeze({requests:count,stopped,complete:count===FILES.length&&!stopped,commit:PIN})},
 });
}
module.exports={createReader,FILES,PIN};
