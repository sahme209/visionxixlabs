'use strict';
const {execFileSync}=require('node:child_process');
const {TextDecoder}=require('node:util');
const MAX=256*1024,MARKER='\nAXIOM_HTTP_STATUS:';
function allowed(raw){
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return false;
 if(url.hostname==='api.github.com')return raw==='https://api.github.com/repos/aws/clock-bound/releases?per_page=10'||url.search===''&&/^\/repos\/aws\/clock-bound\/commits\/[A-Za-z0-9_.-]{1,128}$/.test(url.pathname)||url.search==='?recursive=1'&&/^\/repos\/aws\/clock-bound\/git\/trees\/[a-f0-9]{40}$/.test(url.pathname);
 return url.hostname==='raw.githubusercontent.com'&&url.search===''&&/^\/aws\/clock-bound\/[a-f0-9]{40}\/[A-Za-z0-9_./-]+$/.test(url.pathname)&&!url.pathname.split('/').some(p=>p==='..'||p==='.');
}
/** Public text only. Caller enforces the approved six-slot dependency order.
 * Each real invocation is one request; errors never retry or change transport. */
function readPublicSource(raw,run=execFileSync){
 let output;
 try{
  if(typeof raw!=='string'||!allowed(raw))throw Error('scope');
  const args=['--disable','--proxy','','--noproxy','*','--proto','=https','--proto-redir','=https','--max-redirs','0','--connect-timeout','5','--max-time','10','--max-filesize',String(MAX),'--fail','--silent','--show-error','--write-out',MARKER+'%{http_code}','--url',raw];
  output=run('/usr/bin/curl',args,{timeout:15000,killSignal:'SIGKILL',maxBuffer:MAX,encoding:'buffer',env:{PATH:'/usr/bin:/bin'},stdio:['ignore','pipe','pipe']});
  if(!Buffer.isBuffer(output)||output.length>MAX)throw Error('size');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(output),end=text.lastIndexOf(MARKER);
  if(end<0||text.slice(end+MARKER.length)!=='200')throw Error('status');
  return Object.freeze({url:raw,body:text.slice(0,end),bodyBytes:Buffer.byteLength(text.slice(0,end),'utf8')});
 }catch{throw Error('public_source_read_unavailable')}
}
module.exports={readPublicSource};
