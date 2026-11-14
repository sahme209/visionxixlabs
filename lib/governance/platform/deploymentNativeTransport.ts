import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {preparePlatformVercelDeployment,readPlatformDeploymentResponse} from '@/lib/deploy/platformDeployment';
import {platformEffectSchema,type PlatformEffect} from './contracts';
import {prepareExecutionDispatch,consumeExecutionDispatch,type ExecutionTimeSource,type ExecutionTimeAuthorization,type ExecutionTimeWindow} from './executionTime';
type Effect=Extract<PlatformEffect,{kind:'deployment.vercel'}>;
const stamp=z.number().int().nonnegative().safe();
const credentialSchema=z.object({token:z.string().min(1).max(8192).regex(/^[^\s\x00-\x1f\x7f]+$/),notBefore:stamp,expiresAt:stamp}).strict();
export type DeploymentHeldCredential=Readonly<z.infer<typeof credentialSchema>>;
export interface DeploymentTiming{clock:ExecutionTimeSource;signal:AbortSignal}
export interface DeploymentNativeTransport extends DeploymentTiming{
 send(effect:Effect,body:string,beforeSend:ExecutionTimeAuthorization,beforeCredential:ExecutionTimeAuthorization):Promise<unknown>;
}
interface Ports extends DeploymentTiming{
 fetch(url:string,init:RequestInit):Promise<Response>;
 assertQualified(effect:Effect,signal:AbortSignal):Promise<void>;
 /** Copy an already-held private credential ONLY. No mint/renew/exchange/grant. */
 readHeldCredential(effect:Effect,signal:AbortSignal):Promise<unknown>;
 assertCredentialCurrent(effect:Effect,credential:DeploymentHeldCredential,signal:AbortSignal):Promise<void>;
 /** Clock-free, read-only SAME original native/runtime/source/credential facts; never human or transaction authorization. No fallback. */
 assertDispatchCurrent?(effect:Effect,phase:'deployment.credential.copy'|'deployment.request.send',signal:AbortSignal,credential?:DeploymentHeldCredential):Promise<void>;
}
const payload=z.object({name:z.string(),target:z.literal('production').optional(),files:z.array(z.object({file:z.string(),data:z.string(),encoding:z.literal('base64')}).strict()).min(1).max(1024)}).strict();
const fail=():never=>{throw Error('platform_deployment_native_unavailable')};
const preparedTransports=new WeakSet<object>();
/** Constructor provenance only; not real profile/custody qualification. */
export function assertDeploymentNativeTransport(value:unknown):asserts value is Readonly<DeploymentNativeTransport>{if(!value||typeof value!=='object'||!preparedTransports.has(value))return fail()}
function exactRequest(raw:Effect,body:string):Effect{
 const effect=platformEffectSchema.parse(raw);if(effect.kind!=='deployment.vercel'||typeof body!=='string'||Buffer.byteLength(body)>8*1024*1024)return fail();
 const parsed=payload.parse(JSON.parse(body)),files=parsed.files.map(file=>{const bytes=Buffer.from(file.data,'base64');if(bytes.toString('base64')!==file.data)return fail();return {path:file.file,content:new TextDecoder('utf-8',{fatal:true}).decode(bytes)}});
 const prepared=preparePlatformVercelDeployment(files,{projectName:parsed.name,teamId:effect.target.teamId,target:parsed.target,effectId:effect.id,...(effect.target.leadId&&effect.target.leadRevision?{source:{leadId:effect.target.leadId,leadRevision:effect.target.leadRevision}}:{})});
 if(prepared.body!==body||sha256ContentHash(prepared.effect)!==sha256ContentHash(effect))return fail();Object.freeze(effect.target);return Object.freeze(effect);
}
/** Private fixed transport. Constructor/factory performs no resource access;
 * real profile/custody/clock validity must be qualified, with no default. */
export function createDeploymentNativeTransport(ports:Ports):Readonly<DeploymentNativeTransport>{
 const {clock,signal:original,fetch:send,assertQualified:qualified,readHeldCredential:read,assertCredentialCurrent:current,assertDispatchCurrent:dispatchCurrent}=ports;
 const transport=Object.freeze({clock,signal:original,async send(raw:Effect,body:string,beforeSend:ExecutionTimeAuthorization,beforeCredential:ExecutionTimeAuthorization){
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   if(typeof clock!=='function'||!(original instanceof AbortSignal)||typeof qualified!=='function'||typeof read!=='function'||typeof current!=='function'||typeof dispatchCurrent!=='function'||typeof beforeCredential!=='function'||typeof beforeSend!=='function')return fail();
   const signal=AbortSignal.any([original,controller.signal]);signal.throwIfAborted();const effect=exactRequest(raw,body);
   async function authorize(window:ExecutionTimeWindow,owner:ExecutionTimeAuthorization,post:()=>Promise<void>,binding:object,dispatchFacts:()=>Promise<void>){
    let active=true,started=false,complete=false,invalid=false,finalStarted=false,finalComplete=false;
    try{const checkpoint=await prepareExecutionDispatch(clock,window,(check,last)=>{if(!check||!last)return fail();return owner(restriction=>{const pending=(async()=>{try{if(!active||started)return fail();started=true;await check(restriction);signal.throwIfAborted();await post();signal.throwIfAborted();if(!active)return fail();complete=true}catch{invalid=true;return fail()}})();void pending.catch(()=>{});return pending},()=>{const pending=(async()=>{try{if(!active||finalStarted||!complete)return fail();finalStarted=true;await last();if(!active)return fail();finalComplete=true}catch{invalid=true;return fail()}})();void pending.catch(()=>{});return pending})},signal,binding,dispatchFacts,post);if(!complete||!finalComplete||invalid)return fail();return checkpoint}finally{active=false}
   }
   const expired=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('platform_deployment_native_unavailable'))},15000)});
   return await Promise.race([expired,(async()=>{
    await qualified(effect,signal);signal.throwIfAborted();
    const copyBinding=Object.freeze({phase:'deployment.credential.copy',effect,requestDigest:sha256ContentHash(body)});
    const copyCheckpoint=await authorize({},beforeCredential,async()=>{await qualified(effect,signal)},copyBinding,()=>dispatchCurrent!(effect,'deployment.credential.copy',signal));
    await consumeExecutionDispatch(copyCheckpoint,copyBinding);signal.throwIfAborted();
    const credential=Object.freeze(credentialSchema.parse(await read(effect,signal)));signal.throwIfAborted();if(credential.notBefore>=credential.expiresAt)return fail();
    await current(effect,credential,signal);signal.throwIfAborted();await qualified(effect,signal);signal.throwIfAborted();
    const sendBinding=Object.freeze({phase:'deployment.request.send',effect,requestDigest:copyBinding.requestDigest,credential});
    const sendCheckpoint=await authorize({notBefore:credential.notBefore,expiresAt:credential.expiresAt},beforeSend,async()=>{await qualified(effect,signal);signal.throwIfAborted();await current(effect,credential,signal);signal.throwIfAborted();await qualified(effect,signal)},sendBinding,()=>dispatchCurrent!(effect,'deployment.request.send',signal,credential));
    await consumeExecutionDispatch(sendCheckpoint,sendBinding);signal.throwIfAborted();
    const response=await send('https://api.vercel.com/v13/deployments',{method:'POST',redirect:'error',cache:'no-store',signal,headers:{Authorization:'Bearer '+credential.token,'Content-Type':'application/json','x-vercel-team-id':effect.target.teamId},body});signal.throwIfAborted();if(response.redirected)return fail();const result=await readPlatformDeploymentResponse(response);signal.throwIfAborted();return result;
   })()]);
  }catch{return fail()}finally{if(timer!==undefined)clearTimeout(timer);controller.abort()}
 }});preparedTransports.add(transport);return transport;
}
