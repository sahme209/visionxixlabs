import {denyIsolatedExternalIO} from "@/lib/billing/isolatedApplication/runtime";
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {request as httpsRequest,type RequestOptions} from 'node:https';
import {request as httpRequest,type ClientRequest} from 'node:http';
import {checkServerIdentity} from 'node:tls';
import {CustomerHostedResponseError,customerHostedPrivateAddress,parseCustomerHostedCompletion} from './customerHostedProtocol';
import {readInstallationAIMode,type CustomerHostedOperatorConfig} from './customerHostedConfig';
interface Input {
 readonly config:CustomerHostedOperatorConfig;readonly modelId:string;readonly prompt:string;
 readonly signal:AbortSignal;
 /** Durable one-attempt claim AND current policy/caller fence; mandatory. */
 readonly beforeSend:(terminalSignal?:AbortSignal)=>Promise<void>;
}
interface Dependencies {
 resolve(hostname:string):Promise<readonly {address:string;family:number}[]>;
 request(options:RequestOptions):ClientRequest;
}
const failure=()=>new Error('customer_hosted_transport_unavailable');
function offline(){denyIsolatedExternalIO();if(readInstallationAIMode(process.env.AXIOM_OFFLINE_MODE)!=='offline')throw failure()}
function canonical(ip:string):string {
 if(isIP(ip)===6)return new URL('http://['+ip+']/').hostname;
 return ip;
}
/** Single fixed request, no fetch redirect handling, proxies, agent pooling or
 * retries. Dependency injection is for isolated tests, never workspace input.
 * No caller may use this without token admission/qualified bounds/redaction. */
export async function sendCustomerHostedCompletion(input:Input,deps?:Dependencies):Promise<ReturnType<typeof parseCustomerHostedCompletion>> {
 offline();
 const {config,signal}=input,model=config.models.find(m=>m.id===input.modelId);
 if(signal.aborted||!model||typeof input.prompt!=='string'||Buffer.byteLength(input.prompt)>model.maxInputBytes)throw failure();
 const url=new URL(config.server.baseUrl),host=url.hostname.replace(/^\[|\]$/g,'');
 if(!config.server.allowedHosts.includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/v1'||url.port==='0')throw failure();
 const tls=url.protocol==='https:';
 if(!tls&&!(url.protocol==='http:'&&['localhost','127.0.0.1','::1'].includes(host)))throw failure();
 const body=Buffer.from(JSON.stringify({model:model.id,messages:[{role:'user',content:input.prompt}],max_tokens:model.maxOutputTokens,stream:false,response_format:{type:'json_object'}}));
 if(body.length>262144)throw failure();
 const io=deps??{resolve:(name:string)=>lookup(name,{all:true,verbatim:true}),request:(options:RequestOptions)=>(tls?httpsRequest:httpRequest)(options)};
 return new Promise((resolve,reject)=>{
  let done=false,sent=false,request:ClientRequest|undefined,admissionTask:Promise<void>|undefined;
  const terminal=new AbortController();
  const stop=(error:unknown)=>{
   if(done)return;done=true;terminal.abort();clearTimeout(timer);signal.removeEventListener('abort',abort);request?.destroy();
   const reason=error instanceof CustomerHostedResponseError?error:failure();
   if(!admissionTask){reject(reason);return;}
   // Reconcile in-flight admission before extraction cleanup where possible.
   // Cancellation fences still forbid a late claim if this bounded drain ends.
   let finished=false;
   const finish=()=>{if(finished)return;finished=true;clearTimeout(cleanup);reject(reason)};
   const cleanup=setTimeout(finish,5000);
   void admissionTask.then(finish,finish);
  };
  const abort=()=>stop(failure());
  const timer=setTimeout(abort,10000);timer.unref();signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  void(async()=>{
   const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await io.resolve(host);
   if(done)return;offline();
   if(!addresses.length||addresses.length>16||addresses.some(a=>isIP(a.address)!==a.family||!customerHostedPrivateAddress(a.address)))throw failure();
   if(!tls&&addresses.some(a=>!(isIP(a.address)===4&&a.address.startsWith('127.')||isIP(a.address)===6&&canonical(a.address)==='[::1]')))throw failure();
   const selected=addresses[0],target=canonical(selected.address);
   request=io.request({protocol:url.protocol,hostname:selected.address,family:selected.family,port:url.port?Number(url.port):tls?443:80,path:'/v1/chat/completions',method:'POST',agent:false,rejectUnauthorized:true,
    ...(tls?{servername:isIP(host)?undefined:host,checkServerIdentity:(_name,cert)=>checkServerIdentity(host,cert)}:{}),maxHeaderSize:16384,
    headers:{host:url.host,'content-type':'application/json','content-length':body.length,accept:'application/json','accept-encoding':'identity',connection:'close'}});
   request.once('error',()=>stop(failure()));
   request.once('socket',socket=>{
    socket.once(tls?'secureConnect':'connect',()=>{admissionTask=(async()=>{
     if(done)return;offline();
     const peer=socket.remoteAddress;
     if(!peer||canonical(peer)!==target||!customerHostedPrivateAddress(peer)||tls&&(!('authorized'in socket)||socket.authorized!==true))throw failure();
     await input.beforeSend(terminal.signal);
     if(done||signal.aborted)return;offline();
     // No body bytes are queued until peer and final claim/policy checks pass.
     if(!socket.remoteAddress||canonical(socket.remoteAddress)!==target)throw failure();
     sent=true;request!.end(body);
    })();void admissionTask.catch(stop)});
   });
   request.once('response',response=>{
    if(!sent){response.destroy();stop(failure());return;}
    if(done){response.destroy();return;}
    const contentType=response.headers['content-type'],encoding=response.headers['content-encoding'],length=response.headers['content-length'];
    if(response.statusCode!==200||typeof contentType!=='string'||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)||encoding&&encoding!=='identity'||length!==undefined&&(!/^\d+$/.test(length)||Number(length)>1048576)){
     response.destroy();stop(failure());return;
    }
    const chunks:Buffer[]=[];let bytes=0;
    response.on('data',(chunk:Buffer)=>{if(done)return;const buffer=Buffer.from(chunk);bytes+=buffer.length;if(bytes>1048576){response.destroy();stop(failure());return;}chunks.push(buffer)});
    response.once('error',()=>stop(failure()));response.once('aborted',()=>stop(failure()));
    response.once('end',()=>{
     if(done)return;
     try{const value=parseCustomerHostedCompletion(Buffer.concat(chunks),model.id,model.maxInputTokens,model.maxOutputTokens);done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);resolve(value)}catch(error){stop(error)}
    });
   });
  })().catch(stop);
 });
}
