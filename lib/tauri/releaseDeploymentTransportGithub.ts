import {IMMUTABLE_RELEASE_POLICY} from './releaseImmutableReleasePolicy';
import 'server-only';
import {z} from 'zod';
import {deploymentPlanSchema,deploymentReceiptSchema,type DeploymentPlan,type DeploymentResult} from './releaseDeploymentExecutionContract';
import type {ReleaseDeploymentTransport} from './releaseDeploymentExecutionExecutor';
import {sha256ContentHash} from './contentHash';import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const releaseDeploymentCredentialSchema=z.object({organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string().datetime(),repositoryFullName:z.string(),installationId:z.string().regex(/^[1-9][0-9]{0,19}$/),token:z.string().min(1).max(4096).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v)),expiresAt:z.number().finite(),actionsWrite:z.literal(true),actionsRead:z.literal(true)}).strict();
export const verifiedDeploymentWorkflowSchema=z.object({kind:z.literal('verified_workflow_dispatch_contract_v1'),planDigest:hash,workflowPath:z.string(),workflowBlobSha:z.string(),sourceCommitSha:z.string(),inputsDigest:hash,dispatchSupported:z.literal(true)}).strict();
export interface ReleaseDeploymentGithubDependencies{
 allowImmutableTagDispatch?:()=>boolean;
 isEnabled?:()=>boolean;
 readCredential?:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>Promise<unknown>;
 /** Fresh server-read YAML/input validation, not metadata inferred from a filename. */
 readWorkflowContract?:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>Promise<unknown>;
 /** Must establish a separately supported guarantee; preflight SHA observation alone is not atomic ref dispatch. */
 verifySourcePolicy?:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>Promise<unknown>;
 /** Independent exact run-attempt read must establish workflow_dispatch/repo/path/ref/source identity.
  * Missing/ambiguous readback returns unknown; no global run search or fabricated attempt is permitted. */
 verifyRunReceipt?:(plan:Readonly<DeploymentPlan>,runId:string,signal:AbortSignal)=>Promise<unknown>;
 fetch?:typeof fetch;now?:()=>number;
}
export function createReleaseDeploymentGithubTransport(deps:ReleaseDeploymentGithubDependencies={}):ReleaseDeploymentTransport{
 return{kind:'release_deployment_transport_v1',async execute(input):Promise<DeploymentResult>{
  if(!deps.isEnabled?.()||!deps.readCredential||!deps.readWorkflowContract||!deps.verifySourcePolicy||!deps.verifyRunReceipt||!deps.fetch||input.signal.aborted)return{state:'refused'};
  const now=deps.now??Date.now,controller=new AbortController(),signal=AbortSignal.any([input.signal,controller.signal]),deadline=now()+20000,timer=setTimeout(()=>controller.abort(),20000);let dispatched=false;
  const guard=()=>{signal.throwIfAborted();if(!deps.isEnabled?.()||!Number.isFinite(now())||now()>=deadline)throw Error('deployment_unavailable')};
  const bounded=async<T>(fn:()=>Promise<T>)=>{guard();const result=await withGithubAbort(Promise.resolve().then(()=>{guard();return fn()}),signal);guard();return result};
  try{
   const plan=deploymentPlanSchema.parse(input.plan),digest=sha256ContentHash(plan);if(input.operationId!=='release_deployment_'+sha256ContentHash({organizationId:plan.organizationId,releaseId:plan.releaseId,releaseVersion:plan.releaseVersion,planId:plan.planId}))return{state:'refused'};
   if(plan.sourcePolicy===IMMUTABLE_RELEASE_POLICY&&!deps.allowImmutableTagDispatch?.())return{state:'refused'};
   const current=async()=>{const privateFresh=await bounded(input.assertCurrent);if(privateFresh!==undefined&&typeof privateFresh!=='function')throw Error('deployment_authority_unavailable');const assertFresh=()=>{guard();if(typeof privateFresh==='function')privateFresh();if(now()<Date.parse(plan.windowStart)||now()>=Date.parse(plan.expiresAt))throw Error('deployment_window_unavailable')};assertFresh();return assertFresh};
   await current();const credential=releaseDeploymentCredentialSchema.parse(await bounded(()=>deps.readCredential!(structuredClone(plan),signal)));
   const credentialReady=()=>credential.organizationId===plan.organizationId&&credential.connectionId===plan.connectionId&&credential.connectionRevision===plan.connectionRevision&&credential.repositoryFullName===plan.repositoryFullName&&credential.installationId===plan.installationId&&credential.expiresAt>now()+20000;
   if(!credentialReady())return{state:'refused'};
   const workflow=verifiedDeploymentWorkflowSchema.parse(await bounded(()=>deps.readWorkflowContract!(structuredClone(plan),signal)));
   if(workflow.planDigest!==digest||workflow.workflowPath!==plan.workflowPath||workflow.workflowBlobSha!==plan.workflowBlobSha||workflow.sourceCommitSha!==plan.sourceCommitSha||workflow.inputsDigest!==sha256ContentHash(plan.inputs))return{state:'refused'};
   const policy=z.object({kind:z.literal('verified_release_deployment_source_policy_v1'),planDigest:hash,sourcePolicy:z.string()}).strict().parse(await bounded(()=>deps.verifySourcePolicy!(structuredClone(plan),signal)));if(policy.planDigest!==digest||policy.sourcePolicy!==plan.sourcePolicy)return{state:'refused'};
   const finalFresh=await current();if(!credentialReady())return{state:'refused'};
   const [owner,repo]=plan.repositoryFullName.split('/'),file=plan.workflowPath.split('/').at(-1)!,base=`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,url=`${base}/actions/workflows/${encodeURIComponent(file)}/dispatches`;
   const request:RequestInit={method:'POST',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${credential.token}`,'Content-Type':'application/json','X-GitHub-Api-Version':'2026-03-10'},body:JSON.stringify({ref:plan.sourcePolicy===IMMUTABLE_RELEASE_POLICY?`refs/tags/${plan.ref}`:plan.ref,inputs:plan.inputs}),redirect:'error',credentials:'omit',cache:'no-store',signal};
   const pending=Promise.resolve().then(()=>{if(plan.sourcePolicy===IMMUTABLE_RELEASE_POLICY&&!deps.allowImmutableTagDispatch?.())throw Error('immutable_dispatch_not_admitted');if(!credentialReady()||now()>=Date.parse(plan.expiresAt))throw Error('deployment_expired');finalFresh();dispatched=true;return deps.fetch!(url,request)});void pending.then(r=>{if(signal.aborted||now()>=deadline)void r.body?.cancel().catch(()=>{})},()=>{});
   const response=await bounded(()=>pending);if(response.status!==200||response.redirected||response.url&&response.url!==url){void response.body?.cancel().catch(()=>{});return{state:'unknown'}};
   const bytes=await bounded(()=>readBoundedGithubBody(response,signal,16384));const ack=z.object({workflow_run_id:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),run_url:z.string(),html_url:z.string()}).strict().parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))),runId=String(ack.workflow_run_id);
   if(ack.run_url!==`${base}/actions/runs/${runId}`||ack.html_url!==`https://github.com/${plan.repositoryFullName}/actions/runs/${runId}`)return{state:'unknown'};
   await current();const receipt=deploymentReceiptSchema.parse(await bounded(()=>deps.verifyRunReceipt!(structuredClone(plan),runId,signal)));
   if(receipt.repositoryFullName!==plan.repositoryFullName||receipt.workflowPath!==plan.workflowPath||receipt.headSha!==plan.sourceCommitSha||receipt.ref!==plan.ref||receipt.runId!==runId||receipt.runAttempt!==1)return{state:'unknown'};
   await current();guard();if(!credentialReady())return{state:'unknown'};return{state:'accepted',receipt};
  }catch{return{state:dispatched?'unknown':'refused'}}finally{clearTimeout(timer);controller.abort()}
 }};
}
