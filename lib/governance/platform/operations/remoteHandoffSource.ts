import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {handoffPreflightMetadata,handoffSourceMetadata} from './handoffPreflightContract';
import {operationalWorkloadCommand} from './workloadCommand';
import type {OperationalHandoffSource,OperationalHandoffCapture} from './workloadHandoff';
const profileSchema=z.object({endpoint:z.string().max(2048),preflightEndpoint:z.string().max(2048),audience:z.string().regex(/^[-A-Za-z0-9_]{1,256}$/),workload:handoffPreflightMetadata.shape.workload}).strict();
export type OperationalRemoteHandoffProfile=z.infer<typeof profileSchema>;
export interface OperationalNativeJobIdentity {
 /** Bootstrap-channel consistency only, never authenticated workload identity.
  * The backend must verify signed claims and current authority separately. */
 assertBootstrapCurrent(profile:Readonly<OperationalRemoteHandoffProfile>,signal:AbortSignal):Promise<void>;
 /** One bounded fresh same-job/audience JWT acquisition; no AWS credential. */
 readToken(audience:string,signal:AbortSignal):Promise<string>;
}
const fail=():never=>{throw Error('operational_handoff_source_unavailable')};
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
function endpoint(raw:string){const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.href!==raw||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(url.hostname))return fail();return url}
/** Prepared job-side source bridge. Protected artifact/bootstrap supplies the
 * fixed profile, never request JSON. A fresh qualified GitHub token authenticates
 * read-only server checks; only the separate durable server claim can execute.
 * No native token provider, active workflow/endpoint or qualified default here. */
export function createRemoteOperationalHandoffSource(raw:unknown,native:OperationalNativeJobIdentity):OperationalHandoffSource {
 let profile:Readonly<OperationalRemoteHandoffProfile>;
 try{const parsed=profileSchema.parse(raw);if(endpoint(parsed.endpoint).origin!==endpoint(parsed.preflightEndpoint).origin||parsed.endpoint===parsed.preflightEndpoint)return fail();profile=Object.freeze({...parsed,workload:Object.freeze({...parsed.workload})})}catch{return fail()}
 let used=false,held:{command:z.infer<typeof operationalWorkloadCommand>;token:string;initial:z.infer<typeof handoffPreflightMetadata>;capture:Readonly<OperationalHandoffCapture>}|undefined;
 async function read(command:z.infer<typeof operationalWorkloadCommand>,token:string,signal:AbortSignal,sourceOnly:boolean){
  signal.throwIfAborted();const response=await withGithubAbort(fetch(profile.preflightEndpoint,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(sourceOnly?{...command,operation:'source-current'}:command)}),signal);
  if(response.status!==200){void response.body?.cancel().catch(()=>{});return fail()}
  const bytes=await readBoundedGithubBody(response,signal,65536),envelope=z.object({ok:z.literal(true),data:z.unknown()}).strict().parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))),metadata=(sourceOnly?handoffSourceMetadata:handoffPreflightMetadata).parse(envelope.data);
  if(metadata.actionId!==command.actionId||!same(metadata.workload,profile.workload))return fail();return metadata;
 }
 async function nativeCurrent(signal:AbortSignal){signal.throwIfAborted();await withGithubAbort(native.assertBootstrapCurrent(profile,signal),signal);signal.throwIfAborted()}
 const source:OperationalHandoffSource={
  async capture(rawCommand,signal){if(used)return fail();used=true;try{
   const command=Object.freeze(operationalWorkloadCommand.parse(rawCommand));await nativeCurrent(signal);
   const token=await withGithubAbort(native.readToken(profile.audience,signal),signal);
   if(typeof token!=='string'||token.length>16384||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token))return fail();
   await nativeCurrent(signal);const metadata=await read(command,token,signal,false);await nativeCurrent(signal);
   // Require the admission authority exactly, never a source/history substitute.
   const initial=handoffPreflightMetadata.parse(metadata),capture=Object.freeze({...profile.workload,endpoint:profile.endpoint,audience:profile.audience,manifestDigest:initial.manifestDigest});held={command,token,initial,capture};return capture;
  }catch{return fail()}},
  async assertCurrent(capture,command,signal){try{
   if(!held||!same(capture,held.capture)||!same(command,held.command))return fail();const selected=held;
   await nativeCurrent(signal);const current=await read(selected.command,selected.token,signal,true);await nativeCurrent(signal);
   if(held!==selected||current.manifestDigest!==selected.initial.manifestDigest||current.issuerProfileDigest!==selected.initial.issuerProfileDigest||current.expiresAt!==selected.initial.expiresAt||current.observedAt<selected.initial.observedAt)return fail();
  }catch{return fail()}},
  async readToken(capture,signal){try{if(!held||!same(capture,held.capture))return fail();await nativeCurrent(signal);return held.token}catch{return fail()}},
 };return Object.freeze(source);
}
