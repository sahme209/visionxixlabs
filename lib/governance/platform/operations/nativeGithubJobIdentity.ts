import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort,readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import type {OperationalNativeJobIdentity,OperationalRemoteHandoffProfile} from './remoteHandoffSource';
export interface PrivateGithubJobContext {origin:string;requestUrl:string;requestToken:string}
/** Qualified bootstrap ONLY, never workflow-dispatch JSON or an ambient source.
 * Must establish actual current native job/source/protection before context read.
 * No default capture, environment/file fallback or production qualifier exists. */
export interface PrivateGithubJobSource {
 assertQualified(profile:Readonly<OperationalRemoteHandoffProfile>,signal:AbortSignal):Promise<void>;
 capture(profile:Readonly<OperationalRemoteHandoffProfile>,signal:AbortSignal):Promise<PrivateGithubJobContext>;
 assertCurrent(profile:Readonly<OperationalRemoteHandoffProfile>,signal:AbortSignal):Promise<void>;
}
const fail=():never=>{throw Error('operational_native_job_identity_unavailable')};
/** Concrete one-request transport for the reviewed native-token port. The
 * resulting JWT authenticates Axiom only; no AWS exchange or permission exists.
 * Strict response/URL profile is a candidate requiring real native qualification. */
export function createNativeGithubJobIdentity(source:PrivateGithubJobSource):OperationalNativeJobIdentity {
 let initialization:Promise<void>|undefined,held:{profile:Readonly<OperationalRemoteHandoffProfile>;hash:string;url:string;requestToken:string}|undefined,failed=false,attempted=false,token:string|undefined;
 async function current(signal:AbortSignal){if(failed||!held)return fail();signal.throwIfAborted();await withGithubAbort(source.assertCurrent(held.profile,signal),signal);signal.throwIfAborted()}
 const native:OperationalNativeJobIdentity={
  async assertQualified(raw,signal){try{
   if(failed)return fail();
   const profile=Object.freeze({endpoint:raw.endpoint,preflightEndpoint:raw.preflightEndpoint,audience:raw.audience,workload:Object.freeze({...raw.workload})}),hash=sha256ContentHash(profile);
   if(!initialization)initialization=(async()=>{
    await withGithubAbort(source.assertQualified(profile,signal),signal);signal.throwIfAborted();
    const captured=await withGithubAbort(source.capture(profile,signal),signal);signal.throwIfAborted();
    const origin=captured.origin,requestUrl=captured.requestUrl,requestToken=captured.requestToken,url=new URL(requestUrl),expected=new URL(origin);
    if(expected.origin!==origin||expected.protocol!=='https:'||expected.username||expected.password||expected.port||!expected.hostname.endsWith('.actions.githubusercontent.com')||url.origin!==origin||url.username||url.password||url.port||url.hash||url.protocol!=='https:'||requestUrl.length>4096||typeof requestToken!=='string'||requestToken.length<1||requestToken.length>16384||/[\s\x00-\x1f\x7f]/.test(requestToken))return fail();
    // Native URL query may carry provider coordinates; never record or hash it.
    if(url.searchParams.has('audience'))return fail();url.searchParams.set('audience',profile.audience);
    held={profile,hash,url:url.href,requestToken};
   })();
   await withGithubAbort(initialization,signal);if(!held||held.hash!==hash)return fail();await current(signal);
  }catch{failed=true;return fail()}},
  async readToken(audience,parent){
   const controller=new AbortController(),signal=AbortSignal.any([parent,controller.signal]),timer=setTimeout(()=>controller.abort(),5000);
   try{
    if(failed||!held||audience!==held.profile.audience)return fail();await current(signal);
    if(token)return token;if(attempted)return fail();attempted=true;
    const response=await withGithubAbort(fetch(held.url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{authorization:'Bearer '+held.requestToken}}),signal);
    if(response.status!==200){void response.body?.cancel().catch(()=>{});return fail()}
    const bytes=await readBoundedGithubBody(response,signal,32768),value=z.object({value:z.string().max(16384).regex(/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/)}).strict().parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))).value;
    await current(signal);token=value;return value;
   }catch{failed=true;return fail()}finally{clearTimeout(timer);controller.abort()}
  },
 };return Object.freeze(native);
}
