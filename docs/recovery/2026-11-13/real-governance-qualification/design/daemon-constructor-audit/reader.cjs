'use strict';
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {TextDecoder}=require('node:util');
const PIN='371058f8f6a1786d4a4ab3eed9f5f2f16eea7777',MAX=256*1024,MARKER='\nAXIOM_HTTP_STATUS:';
const FILES=Object.freeze([
 ['clock-bound/src/daemon.rs', '44650a6306fc180bcf5279b81fb5404aefc6c6fb', 37992],
 ['clock-bound/src/daemon/clock_state.rs', '0abef5835e44275920d1c397dae5e89f4b7a42da', 30558],
 ['clock-bound/src/daemon/io.rs', '58fecfb0bc1a37d828be8ac6a9693766c9c1f207', 35932],
 ['clock-bound/src/daemon/clock_state/system_clock_discipliner.rs', 'd1563766e01cf48a5296de7179cb8cae8b5f8750', 5842]
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
