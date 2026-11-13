import 'server-only';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {decryptCredential} from '@/lib/security/credentialVault';
import {preparePlatformLinkedInPost,currentLinkedInVersion,type PostingDraft,type PostingConnection} from '@/lib/growth/linkedin/platformPostingPlan';
import {preparePlatformLinkedInDeletion} from '@/lib/growth/linkedin/platformDeletionPlan';
import {isPostingEnabled} from '@/lib/growth/linkedin/oauth';
import {platformEffectSchema,type PlatformEffect} from './contracts';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readBoundedPlatformJson} from './httpResponse';
import {prepareExecutionDispatch,consumeExecutionDispatch,type ExecutionTimeSource,type ExecutionTimeAuthorization} from './executionTime';
export type GrowthNativeEffect=Extract<PlatformEffect,{kind:'growth.post.publish'|'growth.post.delete'}>;
export type GrowthNativeRequest={kind:'publish';draft:PostingDraft;connection:PostingConnection;version:string;imageLineage?:unknown;imageUploadActionId?:string}|{kind:'delete';source:unknown;version:string};
const stamp=z.number().int().nonnegative().safe();
const profileSchema=z.object({profileDigest:z.string().regex(/^[a-f0-9]{64}$/),actionId:z.string().min(1).max(256),effectDigest:z.string().regex(/^[a-f0-9]{64}$/),credentialVersion:z.string().datetime(),notBefore:stamp,expiresAt:stamp}).strict();
export type GrowthCredentialProfile=Readonly<z.infer<typeof profileSchema>>;
export type GrowthDispatchPhase='credential-read'|'credential-decrypt'|'publish'|'delete';
export interface GrowthTiming{clock:ExecutionTimeSource;signal:AbortSignal;assertActive():void}
export interface GrowthNativeTransport extends GrowthTiming{
 readonly actionId:string;
 send(effect:GrowthNativeEffect,request:GrowthNativeRequest,beforeSend:ExecutionTimeAuthorization,beforeCredential:ExecutionTimeAuthorization,credentialCurrent:ExecutionTimeAuthorization,onDecryptFailure?:()=>void):Promise<Readonly<{kind:'published';urn:string;status:number}|{kind:'deleted'}>>;
}
interface Ports extends GrowthTiming{
 actionId:string;
 /** Private current custody/reader/transport profile, never a ciphertext-row or
  * OAuth-expiry inference. No qualified/default supplier is installed here. */
 assertDispatchCurrent?(effect:GrowthNativeEffect,profile:GrowthCredentialProfile,phase:GrowthDispatchPhase,signal:AbortSignal):Promise<void>;
 readProfile(effect:GrowthNativeEffect,signal:AbortSignal):Promise<unknown>;
 assertProfileCurrent(effect:GrowthNativeEffect,profile:GrowthCredentialProfile,signal:AbortSignal):Promise<void>;
 fetch(url:string,init:RequestInit):Promise<Response>;
}
const fail=():never=>{throw Error('platform_growth_native_unavailable')};
const prepared=new WeakSet<object>();
export function assertGrowthNativeTransport(value:unknown):asserts value is Readonly<GrowthNativeTransport>{if(!value||typeof value!=='object'||!prepared.has(value))return fail()}
const validUrn=(value:unknown):value is string=>typeof value==='string'&&/^urn:li:(share|ugcPost):[A-Za-z0-9_-]{1,128}$/.test(value);
/** Fixed native boundary for copying an ALREADY HELD selected OAuth token.
 * No refresh, ambient token, new grant, automatic retry or public default. */
export function createGrowthNativeTransport(ports:Ports):Readonly<GrowthNativeTransport>{
 const {clock,signal:original,assertActive,actionId,readProfile,assertProfileCurrent,assertDispatchCurrent,fetch:send}=ports;
 const transport=Object.freeze({actionId,clock,signal:original,assertActive,async send(raw:GrowthNativeEffect,input:GrowthNativeRequest,beforeSend:ExecutionTimeAuthorization,beforeCredential:ExecutionTimeAuthorization,credentialCurrent:ExecutionTimeAuthorization,onDecryptFailure?:()=>void){
  const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   if(!(original instanceof AbortSignal)||typeof clock!=='function'||typeof assertActive!=='function'||typeof readProfile!=='function'||typeof assertProfileCurrent!=='function'||typeof beforeSend!=='function'||typeof beforeCredential!=='function'||typeof credentialCurrent!=='function'||typeof assertDispatchCurrent!=='function')return fail();
   const signal=AbortSignal.any([original,abort.signal]),selected=platformEffectSchema.parse(raw);if(selected.kind!=='growth.post.publish'&&selected.kind!=='growth.post.delete')return fail();const effect:GrowthNativeEffect=selected;Object.freeze(effect.target);Object.freeze(effect);
   // Reconstruct actual bytes/URL from the complete source snapshot. Time=0
   // checks only encoding/identity here; the original owner checks all expiry.
   let url:string,body:string|undefined,version:string,credentialVersion:string;
   if(input.kind==='publish'&&effect.kind==='growth.post.publish'){
    const exact=preparePlatformLinkedInPost(input.draft,input.connection,input.version,0,effect.id,input.imageLineage,input.imageUploadActionId);
    if(sha256ContentHash(exact.effect)!==sha256ContentHash(effect))return fail();url='https://api.linkedin.com/rest/posts';body=exact.body;version=exact.version;credentialVersion=input.connection.updatedAt.toISOString();
   }else if(input.kind==='delete'&&effect.kind==='growth.post.delete'){
    const exact=preparePlatformLinkedInDeletion(input.source,input.version,0,effect.id);if(sha256ContentHash(exact.effect)!==sha256ContentHash(effect))return fail();url=exact.url;version=effect.target.apiVersion;credentialVersion=new Date(exact.connectionUpdatedAt).toISOString();
   }else return fail();
   const active=()=>{signal.throwIfAborted();assertActive();signal.throwIfAborted();if(!isPostingEnabled()||currentLinkedInVersion()!==version)return fail()};active();
   const expired=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('platform_growth_native_unavailable'))},15000)});
   return await Promise.race([expired,(async()=>{
    const profile=Object.freeze(profileSchema.parse(await readProfile(effect,signal)));active();
    if(profile.actionId!==actionId||profile.effectDigest!==sha256ContentHash(effect)||profile.credentialVersion!==credentialVersion||profile.notBefore>=profile.expiresAt)return fail();
    async function facts(){active();await assertProfileCurrent(effect,profile,signal);active()}
    async function authorize(owner:ExecutionTimeAuthorization,phase:GrowthDispatchPhase){
     const binding=Object.freeze({effect,profile,phase,url,version,...(body===undefined?{}:{bodyDigest:sha256ContentHash(body)})});
     let live=true,started=false,complete=false,invalid=false,finalStarted=false,finalComplete=false;
     try{
      await facts();const checkpoint=await prepareExecutionDispatch(clock,{notBefore:profile.notBefore,expiresAt:profile.expiresAt},check=>{if(!check)return fail();return owner(restriction=>{const pending=(async()=>{try{if(!live||started)return fail();started=true;await check(restriction);await facts();if(!live)return fail();complete=true}catch{invalid=true;return fail()}})();void pending.catch(()=>{});return pending},()=>{const pending=(async()=>{try{if(!live||finalStarted||!complete)return fail();finalStarted=true;await facts();if(!live)return fail();finalComplete=true}catch{invalid=true;return fail()}})();void pending.catch(()=>{});return pending})},signal,binding,async()=>{active();await assertDispatchCurrent!(effect,profile,phase,signal);active()});
      active();if(!complete||!finalComplete||invalid)return fail();return {checkpoint,binding};
     }finally{live=false}
    }
    const readDispatch=await authorize(beforeCredential,'credential-read');active();await consumeExecutionDispatch(readDispatch.checkpoint,readDispatch.binding);active();
    const stored=await prisma.linkedInAccountConnection.findUnique({where:{id:effect.target.connectionId},select:{accessToken:true,updatedAt:true}});active();
    if(!stored||stored.updatedAt.toISOString()!==credentialVersion)return fail();
    const ciphertext=stored.accessToken,decryptDispatch=await authorize(credentialCurrent,'credential-decrypt');active();await consumeExecutionDispatch(decryptDispatch.checkpoint,decryptDispatch.binding);active();
    let token:string;try{token=decryptCredential(ciphertext)}catch{onDecryptFailure?.();return fail()}
    if(typeof token!=='string'||!token||token.length>16384||/[\s\x00-\x1f\x7f]/.test(token))return fail();
    await authorize(credentialCurrent,'credential-decrypt');active();const sendDispatch=await authorize(beforeSend,effect.kind==='growth.post.publish'?'publish':'delete');active();await consumeExecutionDispatch(sendDispatch.checkpoint,sendDispatch.binding);active();
    const response=await send(url,{method:effect.kind==='growth.post.publish'?'POST':'DELETE',redirect:'error',cache:'no-store',signal,headers:{Authorization:'Bearer '+token,'LinkedIn-Version':version,'X-Restli-Protocol-Version':'2.0.0',...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body}:{})});
    if(response.redirected)return fail();
    if(effect.kind==='growth.post.delete'){void response.body?.cancel().catch(()=>{});if(response.status!==204)return fail();return Object.freeze({kind:'deleted' as const})}
    if(!response.ok){void response.body?.cancel().catch(()=>{});return fail()}
    let urn:unknown=response.headers.get('x-restli-id');
    if(!validUrn(urn)){const result=await readBoundedPlatformJson(response,signal);urn=result&&typeof result==='object'&&!Array.isArray(result)?(result as {id?:unknown}).id:null}else void response.body?.cancel().catch(()=>{});
    if(!validUrn(urn))return fail();return Object.freeze({kind:'published' as const,urn,status:response.status});
   })()]);
  }catch{return fail()}finally{if(timer!==undefined)clearTimeout(timer);abort.abort()}
 }});prepared.add(transport);return transport;
}
