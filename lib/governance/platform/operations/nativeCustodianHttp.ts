import 'server-only';
import * as http from 'node:http';

/** Private transport primitive, NOT an issuer or host qualifier. Call only
 * after the joined durable source-intent and qualified-runtime checks. Never
 * expose the coordinate or returned body through request/history interfaces. */
export async function readNativeCustodianResponse(path: string, signal: AbortSignal): Promise<string> {
 const unavailable=()=>Error('custodian_native_response_unavailable');
 // Deliberately narrower than an arbitrary URI. Real shapes require separate
 // qualification; accepting this grammar does not qualify the actual runtime.
 if(typeof path!=='string'||!/^\/v2\/credentials\/[A-Za-z0-9_-]{1,128}$/.test(path)||signal.aborted)throw unavailable();
 return new Promise((resolve,reject)=>{
  let request:http.ClientRequest|undefined,response:http.IncomingMessage|undefined,settled=false,bytes=0;
  const chunks:Buffer[]=[];
  const finish=(value?:string)=>{
   if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
   // Install error handlers before destruction; destruction can emit late errors.
   response?.destroy();request?.destroy();chunks.length=0;
   if(value===undefined)reject(unavailable());else resolve(value);
  };
  const abort=()=>finish();
  const timer=setTimeout(abort,3000);
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){finish();return}
  try{
   request=http.request({hostname:'169.254.170.2',port:80,path,method:'GET',agent:false,maxHeaderSize:8192,headers:{Accept:'application/json',Connection:'close'}});
   request.on('error',abort);
   request.on('response',(incoming:http.IncomingMessage)=>{
    if(settled){incoming.on('error',()=>{});incoming.destroy();return}
    response=incoming;incoming.on('error',abort);incoming.on('aborted',abort);
    if(incoming.statusCode!==200){finish();return}
    incoming.on('data',(chunk:unknown)=>{
     if(settled)return;
     if(!Buffer.isBuffer(chunk)){finish();return}
     bytes+=chunk.length;if(bytes>65536){finish();return}chunks.push(Buffer.from(chunk));
    });
    incoming.on('end',()=>{
     if(settled)return;
     try{if(!bytes){finish();return}finish(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes)))}catch{finish()}
    });
    incoming.on('close',()=>{if(!settled)finish()});
   });
   request.end();
  }catch{finish()}
 });
}
