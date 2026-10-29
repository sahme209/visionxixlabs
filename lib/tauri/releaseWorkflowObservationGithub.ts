import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from './contentHash';
import {releaseWorkflowEvidenceBindingSchema,releaseWorkflowObservationSchema,type ReleaseWorkflowEvidenceBinding,type ReleaseWorkflowObservation} from './releaseWorkflowEvidenceContract';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
const identity=z.string().min(1).max(240),instant=z.string().datetime();
/** Server-owned permission evidence, not a legacy unprofiled token or client assertion. */
export const releaseWorkflowReadCredentialSchema=z.object({organizationId:identity,connectionId:identity,connectionRevision:instant,repositoryFullName:z.string(),installationId:z.string().regex(/^[1-9][0-9]{0,19}$/),token:z.string().min(1).max(4096).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v)),expiresAt:z.number().finite(),actionsRead:z.literal(true)}).strict();
export type ReleaseWorkflowReadCredential=z.infer<typeof releaseWorkflowReadCredentialSchema>;
export interface ReleaseWorkflowObservationGithubDependencies{
 isEnabled?:()=>boolean;
 assertCurrent?:(binding:Readonly<ReleaseWorkflowEvidenceBinding>,signal:AbortSignal)=>Promise<void>;
 /** Must independently establish genuine release-specific dispatch provenance and exact run/attempt.
  * A copied run URL, global WorkflowRunRecord or workflow_dispatch event alone is insufficient. */
 readTrustedDispatchBinding?:(binding:Readonly<ReleaseWorkflowEvidenceBinding>,signal:AbortSignal)=>Promise<unknown>;
 readCredential?:(binding:Readonly<ReleaseWorkflowEvidenceBinding>,signal:AbortSignal)=>Promise<unknown>;
 fetch?:typeof fetch;now?:()=>number;
}
const nativeId=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const runSchema=z.object({id:nativeId,run_attempt:nativeId,workflow_id:nativeId,path:z.string(),event:z.literal('workflow_dispatch'),head_sha:z.string().regex(/^[a-f0-9]{40}$/),head_branch:z.string(),repository:z.object({full_name:z.string()}).passthrough(),head_repository:z.object({full_name:z.string()}).passthrough(),status:z.enum(['queued','in_progress','completed']),conclusion:z.enum(['success','failure','cancelled','skipped','timed_out','action_required','neutral']).nullable()}).passthrough();
const workflowSchema=z.object({id:nativeId,path:z.string()}).passthrough();
/** Fixed read-only GitHub endpoints verified against official workflow-runs/workflows REST docs.
 * Observed source SHA is evidence, never an atomic workflow-dispatch SHA guard.
 * No default verifier, credential reader, network transport or production activation is installed. */
export function createReleaseWorkflowObservationGithub(deps:ReleaseWorkflowObservationGithubDependencies={}){
 return async(raw:Readonly<ReleaseWorkflowEvidenceBinding>,callerSignal:AbortSignal):Promise<ReleaseWorkflowObservation|null>=>{
  if(!deps.isEnabled?.()||!deps.assertCurrent||!deps.readTrustedDispatchBinding||!deps.readCredential||!deps.fetch||callerSignal.aborted)return null;
  const now=deps.now??Date.now,controller=new AbortController(),signal=AbortSignal.any([callerSignal,controller.signal]),deadline=now()+10000,timer=setTimeout(()=>controller.abort(),10000),budget={remainingBytes:192*1024};
  const guard=()=>{signal.throwIfAborted();if(!deps.isEnabled?.()||!Number.isFinite(now())||now()>=deadline)throw Error('workflow_observation_unavailable')};
  const bounded=async<T>(fn:()=>Promise<T>)=>{guard();const result=await withGithubAbort(Promise.resolve().then(()=>{guard();return fn()}),signal);guard();return result};
  try{
   const binding=releaseWorkflowEvidenceBindingSchema.parse(raw),digest=sha256ContentHash(binding);
   async function current(){await bounded(()=>deps.assertCurrent!(structuredClone(binding),signal));if(Date.parse(binding.expiresAt)<=now())throw Error('workflow_binding_expired');const trusted=releaseWorkflowEvidenceBindingSchema.parse(await bounded(()=>deps.readTrustedDispatchBinding!(structuredClone(binding),signal)));if(sha256ContentHash(trusted)!==digest)throw Error('workflow_dispatch_unbound');guard();if(Date.parse(binding.expiresAt)<=now())throw Error('workflow_binding_expired')}
   await current();const credential=releaseWorkflowReadCredentialSchema.parse(await bounded(()=>deps.readCredential!(structuredClone(binding),signal)));
   const credentialReady=()=>credential.organizationId===binding.organizationId&&credential.connectionId===binding.connectionId&&credential.connectionRevision===binding.connectionRevision&&credential.repositoryFullName===binding.repositoryFullName&&credential.actionsRead===true&&credential.expiresAt>now()+15000;
   if(!credentialReady())return null;
   async function get(url:string){await current();if(!credentialReady())throw Error('workflow_credential_expired');const pending=Promise.resolve().then(()=>{guard();if(!credentialReady())throw Error('workflow_credential_expired');return deps.fetch!(url,{method:'GET',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${credential.token}`,'X-GitHub-Api-Version':'2022-11-28'},credentials:'omit',cache:'no-store',redirect:'error',signal})});void pending.then(response=>{if(signal.aborted||now()>=deadline)void response.body?.cancel().catch(()=>{})},()=>{});const response=await bounded(()=>pending);if(response.status!==200||response.redirected||response.url&&response.url!==url||response.headers.has('link')){void response.body?.cancel().catch(()=>{});throw Error('workflow_read_unavailable')}const bytes=await bounded(()=>readBoundedGithubBody(response,signal,128*1024,budget));const result:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await current();if(!credentialReady())throw Error('workflow_credential_expired');return result}
   const [owner,repo]=binding.repositoryFullName.split('/'),base=`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
   const run=runSchema.parse(await get(`${base}/actions/runs/${binding.runId}/attempts/${binding.runAttempt}`));
   if(String(run.id)!==binding.runId||run.run_attempt!==binding.runAttempt||run.head_sha!==binding.sourceCommit||run.head_branch!==binding.dispatchedRef||run.path!==binding.workflowPath||run.repository.full_name!==binding.repositoryFullName||run.head_repository.full_name!==binding.repositoryFullName)return null;
   const workflow=workflowSchema.parse(await get(`${base}/actions/workflows/${run.workflow_id}`));if(workflow.id!==run.workflow_id||workflow.path!==binding.workflowPath)return null;
   await current();guard();if(!credentialReady())return null;
   return releaseWorkflowObservationSchema.parse({bindingDigest:digest,provenance:'verified_release_dispatch',status:run.status,conclusion:run.conclusion,observedAt:new Date(now()).toISOString()});
  }catch{return null}finally{clearTimeout(timer);controller.abort()}
 };
}
