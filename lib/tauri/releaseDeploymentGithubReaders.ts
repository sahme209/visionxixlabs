import 'server-only';
import {z} from 'zod';
import {deploymentPlanSchema,type DeploymentPlan} from './releaseDeploymentExecutionContract';
import {sha256ContentHash} from './contentHash';
import {validateWorkflowExecutionContract} from '@/lib/connectors/github/workflowExecutionContract';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
const credentialSchema=z.object({organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string().datetime(),repositoryFullName:z.string(),installationId:z.string(),token:z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/),expiresAt:z.number().finite(),permissions:z.object({contents:z.literal('read'),actions:z.literal('read'),metadata:z.literal('read')}).strict()}).strict();
export interface ReleaseDeploymentReadDependencies {
 isEnabled?:()=>boolean;
 assertCurrent?:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>Promise<void>;
 readCredential?:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>Promise<unknown>;
 fetch?:typeof fetch;
 now?:()=>number;
}
const nativeId=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** Fixed, bounded reads. A copied run URL or successful workflow is never deployment certification. */
export function createReleaseDeploymentGithubReaders(deps:ReleaseDeploymentReadDependencies={}){
 async function read<T>(raw:Readonly<DeploymentPlan>,caller:AbortSignal,work:(plan:DeploymentPlan,get:(path:string)=>Promise<unknown>)=>Promise<T>):Promise<T|null>{
  if(!deps.isEnabled?.()||!deps.assertCurrent||!deps.readCredential||!deps.fetch||caller.aborted)return null;
  const now=deps.now??Date.now,deadline=now()+10000,controller=new AbortController(),signal=AbortSignal.any([caller,controller.signal]);
  const timer=setTimeout(()=>controller.abort(),10000),budget={remainingBytes:256*1024};
  const guard=()=>{signal.throwIfAborted();if(!deps.isEnabled?.()||!Number.isFinite(now())||now()>=deadline)throw Error('release_read_unavailable')};
  const bounded=async<V>(fn:()=>Promise<V>)=>{guard();const value=await withGithubAbort(Promise.resolve().then(()=>{guard();return fn()}),signal);guard();return value};
  try{
   const plan=deploymentPlanSchema.parse(raw);
   const credential=credentialSchema.parse(await bounded(()=>deps.readCredential!(structuredClone(plan),signal)));
   const current=async()=>{await bounded(()=>deps.assertCurrent!(structuredClone(plan),signal));if(credential.organizationId!==plan.organizationId||credential.connectionId!==plan.connectionId||credential.connectionRevision!==plan.connectionRevision||credential.repositoryFullName!==plan.repositoryFullName||credential.installationId!==plan.installationId||credential.expiresAt<=now()+15000||now()>=Date.parse(plan.expiresAt))throw Error('release_read_unavailable')};
   const base=`https://api.github.com/repos/${plan.repositoryFullName.split('/').map(encodeURIComponent).join('/')}`;
   const get=async(path:string)=>{
    await current();const url=base+path;
    const pending=Promise.resolve().then(()=>{guard();return deps.fetch!(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${credential.token}`,'X-GitHub-Api-Version':'2022-11-28'}})});
    void pending.then(r=>{if(signal.aborted||now()>=deadline)void r.body?.cancel().catch(()=>{})},()=>{});
    const response=await bounded(()=>pending);
    if(response.status!==200||response.redirected||response.url&&response.url!==url||response.headers.has('link')){void response.body?.cancel().catch(()=>{});throw Error('release_read_incomplete')}
    const bytes=await bounded(()=>readBoundedGithubBody(response,signal,192*1024,budget));const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await current();return value;
   };
   await current();const result=await work(plan,get);await current();guard();return result;
  }catch{return null}finally{clearTimeout(timer);controller.abort()}
 }
 return {
  readSourceTag:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>read(plan,signal,async(p,get)=>{
   if(p.refKind!=='tag'||!/^axiom-release-[A-Za-z0-9_-]{1,100}$/.test(p.ref))throw Error('release_ref_unsupported');
   const tag=z.object({ref:z.string(),object:z.object({type:z.literal('commit'),sha:z.string().regex(/^[a-f0-9]{40}$/)}).passthrough()}).passthrough().parse(await get(`/git/ref/tags/${encodeURIComponent(p.ref)}`));
   if(tag.ref!==`refs/tags/${p.ref}`)throw Error('release_ref_changed');return tag.object.sha;
  }),
  readWorkflowContract:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>read(plan,signal,async(p,get)=>{
   const file=z.object({type:z.literal('file'),path:z.string(),sha:z.string().regex(/^[a-f0-9]{40}$/),encoding:z.literal('base64'),content:z.string().max(150000)}).passthrough().parse(await get(`/contents/${p.workflowPath.split('/').map(encodeURIComponent).join('/')}?ref=${p.sourceCommitSha}`));
   const encoded=file.content.replace(/\n/g,'');if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw Error('workflow_encoding_invalid');
   const content=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(encoded,'base64'));
   const expectedSource={repositoryFullName:p.repositoryFullName,ref:p.sourceCommitSha,path:p.workflowPath,blobSha:p.workflowBlobSha};
   if(file.path!==p.workflowPath||file.sha!==p.workflowBlobSha||!validateWorkflowExecutionContract({expectedSource,currentSource:{...expectedSource,path:file.path,blobSha:file.sha},content,inputs:p.inputs}).ok)throw Error('workflow_contract_changed');
   return {kind:'verified_workflow_dispatch_contract_v1' as const,planDigest:sha256ContentHash(p),workflowPath:p.workflowPath,workflowBlobSha:p.workflowBlobSha,sourceCommitSha:p.sourceCommitSha,inputsDigest:sha256ContentHash(p.inputs),dispatchSupported:true as const};
  }),
  verifyRunReceipt:(plan:Readonly<DeploymentPlan>,runId:string,signal:AbortSignal)=>{
   if(!/^[1-9][0-9]{0,19}$/.test(runId))return Promise.resolve(null);
   return read(plan,signal,async(p,get)=>{
    const run=z.object({id:nativeId,run_attempt:z.literal(1),workflow_id:nativeId,event:z.literal('workflow_dispatch'),path:z.string(),head_sha:z.string(),head_branch:z.string(),repository:z.object({full_name:z.string()}).passthrough(),head_repository:z.object({full_name:z.string()}).passthrough()}).passthrough().parse(await get(`/actions/runs/${runId}/attempts/1`));
    if(String(run.id)!==runId||run.path!==p.workflowPath||run.head_sha!==p.sourceCommitSha||run.head_branch!==p.ref||run.repository.full_name!==p.repositoryFullName||run.head_repository.full_name!==p.repositoryFullName)throw Error('release_run_unbound');
    const workflow=z.object({id:nativeId,path:z.string()}).passthrough().parse(await get(`/actions/workflows/${run.workflow_id}`));
    if(workflow.id!==run.workflow_id||workflow.path!==p.workflowPath)throw Error('release_workflow_unbound');
    return {repositoryFullName:p.repositoryFullName,workflowPath:p.workflowPath,headSha:p.sourceCommitSha,ref:p.ref,runId,runAttempt:1};
   });
  }
 };
}
