'use strict';
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {TextDecoder}=require('node:util');
const PIN='371058f8f6a1786d4a4ab3eed9f5f2f16eea7777',MAX=256*1024,MARKER='\nAXIOM_HTTP_STATUS:';
const FILES=Object.freeze([
 ['clock-bound/src/shm.rs','7e52241b064f863d3d5a95f3d3339b9883c35871',52818],
 ['clock-bound/src/shm/reader.rs','275608b099ac7dbed8d093857c3d8b717a1cea4d',34950],
 ['clock-bound/src/shm/tsc.rs','a1d4b959d7f30106dcd1c06091a8a4ea6598d78a',3095],
 ['clock-bound/src/vmclock/shm_reader.rs','b467c7dc654b9efdf02730bc4abf3982cb4dce26',25743]
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
