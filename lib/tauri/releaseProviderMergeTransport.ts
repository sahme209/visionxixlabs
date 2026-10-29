import 'server-only';
import {z} from 'zod';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from './releaseOperationPlanContract';
const sha=z.string().regex(/^[a-f0-9]{40}$/);
const prSchema=z.object({number:z.number().int().positive(),state:z.enum(['open','closed']),draft:z.boolean(),merged:z.boolean(),merge_commit_sha:sha.nullable(),head:z.object({sha,ref:z.string(),repo:z.object({full_name:z.string()}).nullable()}),base:z.object({sha,ref:z.string(),repo:z.object({full_name:z.string()})})});
export interface ProviderMergeCredential {organizationId:string;connectionId:string;connectionRevision:string;repositoryFullName:string;installationId:string;token:string;expiresAt:number;contentsWrite:true;pullRequestsRead:true}
export interface DirectMergeSupport {organizationId:string;connectionId:string;connectionRevision:string;repositoryFullName:string;pullRequestNumber:number;headSha:string;baseSha:string;mergeQueueRequired:false;stacked:false;sourcePolicy:'expected_head_observed_base'}
export type ProviderMergeTransportResult={state:'confirmed';receipt:{repositoryFullName:string;pullRequestNumber:number;headSha:string;mergeSha:string}}|{state:'refused'|'unknown'};
export interface ProviderMergeTransport {kind:'provider_merge_transport_v1';execute(input:{operationId:string;plan:Readonly<ReleaseOperationPlan>;signal:AbortSignal}):Promise<ProviderMergeTransportResult>}
export type ProviderMergePhase='authority'|'credential'|'policy'|'target'|'final_authority'|'write'|'confirmation';
export interface ProviderMergeTransportPorts {
 /** Static stage/outcome only. Never pass provider bodies, credentials or errors. */
 onDiagnostic?:(event:{phase:ProviderMergePhase;outcome:'started'|'refused'|'unknown'|'confirmed'})=>void;
 isEnabled?:()=>boolean;
 assertCurrent?:(operationId:string,plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal)=>Promise<void>;
 readCredential?:(plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal)=>Promise<ProviderMergeCredential|null>;
 /** Trusted, fresh repository/PR policy verification; absent queue/stack evidence refuses. */
 readDirectMergeSupport?:(plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal,credential:Readonly<ProviderMergeCredential>)=>Promise<DirectMergeSupport|null>;
 fetch?:typeof fetch;
 now?:()=>number;
}
export function createReleaseProviderMergeTransport(ports:ProviderMergeTransportPorts={}):ProviderMergeTransport {
 return {kind:'provider_merge_transport_v1',async execute(input){
  let phase:ProviderMergePhase='authority';
  const diagnostic=(outcome:'started'|'refused'|'unknown'|'confirmed')=>{try{ports.onDiagnostic?.({phase,outcome})}catch{ /* Diagnostics cannot authorize or alter an operation. */ }};
  const stage=(next:ProviderMergePhase)=>{phase=next;diagnostic('started')};
  const refused=():ProviderMergeTransportResult=>{diagnostic('refused');return {state:'refused'}};
  const unknown=():ProviderMergeTransportResult=>{diagnostic('unknown');return {state:'unknown'}};
  let writeStarted=false;const controller=new AbortController(),stop=()=>controller.abort();input.signal.addEventListener('abort',stop,{once:true});if(input.signal.aborted)stop();
  const timer=setTimeout(stop,20000),signal=controller.signal;let activeReader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  const now=ports.now??Date.now,deadlineAt=now()+20000;
  function budget(){signal.throwIfAborted();const at=now();if(!Number.isFinite(deadlineAt)||!Number.isFinite(at)||at>=deadlineAt)throw Error('merge_deadline_elapsed')}
  async function current(plan:ReleaseOperationPlan){budget();if(!ports.isEnabled?.()||!ports.assertCurrent||now()>=Date.parse(plan.window.endUtc)||now()<Date.parse(plan.window.startUtc))throw Error('merge_unavailable');await ports.assertCurrent(input.operationId,structuredClone(plan),signal);budget();if(!ports.isEnabled?.()||now()>=Date.parse(plan.window.endUtc))throw Error('merge_unavailable')}
  async function jsonRequest(url:string,init:RequestInit){budget();const response=await (ports.fetch??fetch)(url,{...init,signal,redirect:'error',cache:'no-store'});try{budget()}catch(error){void response.body?.cancel().catch(()=>{});throw error}if(response.url&&response.url!==url||response.redirected)throw Error('redirect');if(!response.body)throw Error('missing_body');const reader=response.body.getReader();activeReader=reader;let bytes=0;const chunks:Uint8Array[]=[];try{for(;;){budget();const part=await reader.read();budget();if(part.done)break;bytes+=part.value.byteLength;if(bytes>65536)throw Error('large_reply');chunks.push(part.value)}const all=new Uint8Array(bytes);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.byteLength}const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all)) as unknown;budget();return {status:response.status,body}}finally{activeReader=undefined;void reader.cancel().catch(()=>{})}}
  const work=(async():Promise<ProviderMergeTransportResult>=>{try{
   const plan=parseReleaseOperationPlan(input.plan);if(!/^release_merge_provider_[a-f0-9]{64}$/.test(input.operationId))return refused();
   stage('authority');await current(plan);if(!ports.readCredential||!ports.readDirectMergeSupport)return refused();
   stage('credential');const credential=await ports.readCredential(structuredClone(plan),signal);
   const credentialReady=()=>credential&&credential.organizationId===plan.organizationId&&credential.connectionId===plan.connectionId&&credential.connectionRevision===plan.connectionRevision&&credential.repositoryFullName===plan.pullRequest.repositoryFullName&&/^[1-9][0-9]{0,19}$/.test(credential.installationId)&&typeof credential.token==='string'&&credential.token.length>0&&credential.token.length<=4096&&!/[\x00-\x20\x7f-\x9f]/.test(credential.token)&&credential.contentsWrite===true&&credential.pullRequestsRead===true&&Number.isFinite(credential.expiresAt)&&credential.expiresAt>now()+20000;
   if(!credentialReady())return refused();
   stage('policy');const support=await ports.readDirectMergeSupport(structuredClone(plan),signal,structuredClone(credential!));budget();
   if(!credentialReady()||!support||support.organizationId!==plan.organizationId||support.connectionId!==plan.connectionId||support.connectionRevision!==plan.connectionRevision||support.repositoryFullName!==plan.pullRequest.repositoryFullName||support.pullRequestNumber!==plan.pullRequest.number||support.headSha!==plan.pullRequest.headSha||support.baseSha!==plan.pullRequest.baseSha||support.mergeQueueRequired!==false||support.stacked!==false||support.sourcePolicy!=='expected_head_observed_base')return refused();
   const [owner,repo]=plan.pullRequest.repositoryFullName.split('/');if([owner,repo].some(v=>v==='.'||v==='..'))return refused();
   const url=`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${plan.pullRequest.number}`;
   const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${credential!.token}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
   stage('target');const read=await jsonRequest(url,{method:'GET',headers});if(read.status!==200)return refused();const before=prSchema.parse(read.body);
   const target=(v:z.infer<typeof prSchema>)=>v.number===plan.pullRequest.number&&v.head.sha===plan.pullRequest.headSha&&v.head.ref===plan.pullRequest.headRef&&v.head.repo?.full_name===plan.pullRequest.repositoryFullName&&v.base.ref===plan.pullRequest.baseRef&&v.base.repo.full_name===plan.pullRequest.repositoryFullName;
   if(!target(before)||before.state!=='open'||before.draft||before.merged||before.base.sha!==plan.pullRequest.baseSha)return refused();
   stage('final_authority');await current(plan);if(!credentialReady())return refused();budget();stage('write');writeStarted=true;
   const merged=await jsonRequest(url+'/merge',{method:'PUT',headers,body:JSON.stringify({sha:plan.pullRequest.headSha,merge_method:plan.method})});
   if([403,404,405,409,422].includes(merged.status))return refused();
   if(merged.status!==200)return unknown();const ack=z.object({sha,merged:z.literal(true)}).parse(merged.body);
   stage('confirmation');const reread=await jsonRequest(url,{method:'GET',headers});if(reread.status!==200)return unknown();const after=prSchema.parse(reread.body);
   if(!target(after)||after.state!=='closed'||after.merged!==true||after.merge_commit_sha!==ack.sha)return unknown();
   budget();diagnostic('confirmed');return {state:'confirmed',receipt:{repositoryFullName:plan.pullRequest.repositoryFullName,pullRequestNumber:plan.pullRequest.number,headSha:plan.pullRequest.headSha,mergeSha:ack.sha}};
  }catch{diagnostic(writeStarted?'unknown':'refused');return {state:writeStarted?'unknown':'refused'}}})();
  let rejectStop!:(value:ProviderMergeTransportResult)=>void;
  const stopped=new Promise<ProviderMergeTransportResult>(resolve=>{rejectStop=resolve});
  const onStop=()=>{diagnostic(writeStarted?'unknown':'refused');void activeReader?.cancel().catch(()=>{});rejectStop({state:writeStarted?'unknown':'refused'})};signal.addEventListener('abort',onStop,{once:true});if(signal.aborted)onStop();
  try{return await Promise.race([work,stopped])}finally{clearTimeout(timer);input.signal.removeEventListener('abort',stop);signal.removeEventListener('abort',onStop);controller.abort()}
 }};
}
