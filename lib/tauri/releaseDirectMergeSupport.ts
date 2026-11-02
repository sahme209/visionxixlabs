import {sha256ContentHash} from './contentHash';
import 'server-only';
import {z} from 'zod';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from './releaseOperationPlanContract';
import {parseRepositoryFullName} from '@/lib/connectors/github/resolveTenantScopedToken';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {DirectMergeSupport,ProviderMergeCredential} from './releaseProviderMergeTransport';
export type ProviderMergeReadCredential=Omit<ProviderMergeCredential,'contentsWrite'>&{contentsRead:true;contentsWrite?:never};
export type ProviderMergePolicyCredential=ProviderMergeCredential|ProviderMergeReadCredential;
const sha=z.string().regex(/^[a-f0-9]{40}$/),id=z.string().min(1).max(240),instant=z.string().datetime();
export const verifiedUnstackedTopologySchema=z.object({kind:z.literal('verified_unstacked_topology_v1'),organizationId:id,connectionId:id,connectionRevision:instant,repositoryFullName:z.string().max(201),pullRequestNumber:z.number().int().positive(),headSha:sha,baseSha:sha,evidenceDigest:z.string().regex(/^[a-f0-9]{64}$/),observedAt:instant,expiresAt:instant}).strict();
export interface ReleaseDirectMergeSupportDependencies{
 onDiagnostic?:(event:{phase:'authority'|'repository'|'pull_request'|'effective_rules'|'topology'|'final_authority';outcome:'verified'|'refused'|'deadline_or_abort'})=>void;
 isEnabled?:()=>boolean;
 assertCurrent?:(plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal)=>Promise<void|(()=>void)>;
 /** Mandatory trusted graph/topology verification, not caller metadata, labels or a default-branch inference.
  * No production verifier is installed by this module. Exact recorded evidence must be freshly revalidated. */
 readTopologyEvidence?:(plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal)=>Promise<unknown>;
 fetch?:typeof fetch;
 now?:()=>number;
}
const repository=z.object({full_name:z.string(),archived:z.boolean(),disabled:z.boolean(),default_branch:z.string(),allow_merge_commit:z.boolean(),allow_squash_merge:z.boolean(),allow_rebase_merge:z.boolean()}).passthrough();
const pullRequest=z.object({number:z.number().int().positive(),state:z.literal('open'),draft:z.literal(false),merged:z.literal(false),head:z.object({sha,ref:z.string(),repo:z.object({full_name:z.string()}).passthrough()}).passthrough(),base:z.object({sha,ref:z.string(),repo:z.object({full_name:z.string()}).passthrough()}).passthrough()}).passthrough();
const knownRules=new Set(['creation','update','deletion','required_linear_history','required_deployments','required_signatures','pull_request','required_status_checks','non_fast_forward','required_workflows','code_scanning','merge_queue','commit_message_pattern','commit_author_email_pattern','committer_email_pattern','branch_name_pattern','file_path_restriction','max_file_path_length','file_extension_restriction','max_file_size']);
const verifiedSupportEvidence=new WeakMap<object,{planDigest:string;credentialDigest:string;supportDigest:string;sourceDigest:string;observedAt:string;expiresAt:string}>();
/** Only results issued by this actual reader carry provenance. An optional
 * caller field, copied object or synthetic transport Boolean cannot supply it. */
export function readVerifiedDirectMergeSupportEvidence(raw:unknown,plan:Readonly<ReleaseOperationPlan>,credential:Readonly<ProviderMergePolicyCredential>){
 if(!raw||typeof raw!=='object')throw Error('merge_support_evidence_unavailable');
 const proof=verifiedSupportEvidence.get(raw);
 if(!proof||proof.planDigest!==sha256ContentHash(plan)||proof.credentialDigest!==sha256ContentHash(credential)||proof.supportDigest!==sha256ContentHash(raw))throw Error('merge_support_evidence_unavailable');
 return{sourceDigest:proof.sourceDigest,observedAt:proof.observedAt,expiresAt:proof.expiresAt};
}
/** Active-branch rules are all active organization/repository rules. Any uncertain/truncated policy refuses.
 * This is not proof that the installation actor lacks ruleset/protection bypass entitlement.
 * Production authority wiring must independently verify that policy; no such verifier is installed here. */
export function createReleaseDirectMergeSupportReader(deps:ReleaseDirectMergeSupportDependencies={}){
 return async(rawPlan:Readonly<ReleaseOperationPlan>,inputSignal:AbortSignal,credential:Readonly<ProviderMergePolicyCredential>):Promise<DirectMergeSupport|null>=>{
  if(!deps.isEnabled?.()||!deps.assertCurrent||!deps.readTopologyEvidence||!deps.fetch||inputSignal.aborted)return null;
  const now=deps.now??Date.now,deadline=now()+12000,controller=new AbortController(),signal=AbortSignal.any([inputSignal,controller.signal]),timer=setTimeout(()=>controller.abort(),12000),budget={remainingBytes:256*1024};
  let currentFresh:(()=>void)|undefined;const guard=()=>{signal.throwIfAborted();currentFresh?.();if(!deps.isEnabled?.()||!Number.isFinite(now())||now()>=deadline)throw Error('direct_merge_policy_unavailable')};
  const bounded=async<T>(fn:()=>Promise<T>)=>{guard();const out=await withGithubAbort(Promise.resolve().then(()=>{guard();return fn()}),signal);guard();return out};
  let phase:Parameters<NonNullable<ReleaseDirectMergeSupportDependencies['onDiagnostic']>>[0]['phase']='authority',verified=false;
  try{
   const plan=parseReleaseOperationPlan(rawPlan),ref=parseRepositoryFullName(plan.pullRequest.repositoryFullName);if(!ref)return null;
   const credentialReady=()=>credential&&credential.organizationId===plan.organizationId&&credential.connectionId===plan.connectionId&&credential.connectionRevision===plan.connectionRevision&&credential.repositoryFullName===plan.pullRequest.repositoryFullName&&/^[1-9][0-9]{0,19}$/.test(credential.installationId)&&typeof credential.token==='string'&&credential.token.length>0&&credential.token.length<=4096&&!/[\x00-\x20\x7f-\x9f]/.test(credential.token)&&((credential.contentsWrite===true&&!('contentsRead'in credential))||('contentsRead'in credential&&credential.contentsRead===true&&!('contentsWrite'in credential)))&&credential.pullRequestsRead===true&&Number.isFinite(credential.expiresAt)&&credential.expiresAt>now()+20000;
   const current=async()=>{const fresh=await bounded(()=>deps.assertCurrent!(structuredClone(plan),signal));if(fresh!==undefined&&typeof fresh!=='function')throw Error('direct_merge_authority_unavailable');if(typeof fresh==='function'){const prior=currentFresh;currentFresh=()=>{prior?.();if(fresh()!==undefined)throw Error('direct_merge_authority_unavailable')}}guard();if(!credentialReady())throw Error('direct_merge_credential_unavailable')};
   await current();
   async function get(url:string){await current();const fetching=Promise.resolve().then(()=>{guard();if(!credentialReady())throw Error('direct_merge_credential_unavailable');return deps.fetch!(url,{method:'GET',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${credential.token}`,'X-GitHub-Api-Version':'2022-11-28'},redirect:'error',credentials:'omit',cache:'no-store',signal})});void fetching.then(r=>{if(signal.aborted||now()>=deadline)void r.body?.cancel().catch(()=>{})},()=>{});const response=await bounded(()=>fetching);if(response.status!==200||response.redirected||response.url&&response.url!==url||response.headers.has('link')){void response.body?.cancel().catch(()=>{});throw Error('direct_merge_policy_incomplete')}const bytes=await bounded(()=>readBoundedGithubBody(response,signal,128*1024,budget));const data:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await current();return data}
   phase='repository';const url=`https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`,r=repository.parse(await get(url));
   if(r.full_name!==plan.pullRequest.repositoryFullName||r.archived||r.disabled||r.default_branch!==plan.pullRequest.baseRef||!({merge:r.allow_merge_commit,squash:r.allow_squash_merge,rebase:r.allow_rebase_merge}[plan.method]))return null;
   phase='pull_request';const pr=pullRequest.parse(await get(`${url}/pulls/${plan.pullRequest.number}`));if(pr.number!==plan.pullRequest.number||pr.head.sha!==plan.pullRequest.headSha||pr.head.ref!==plan.pullRequest.headRef||pr.head.repo.full_name!==plan.pullRequest.repositoryFullName||pr.base.sha!==plan.pullRequest.baseSha||pr.base.ref!==plan.pullRequest.baseRef||pr.base.repo.full_name!==plan.pullRequest.repositoryFullName)return null;
   phase='effective_rules';const rules=z.array(z.object({type:z.string().min(1).max(100)}).passthrough()).max(99).parse(await get(`${url}/rules/branches/${encodeURIComponent(plan.pullRequest.baseRef)}?per_page=100&page=1`));if(rules.some(rule=>!knownRules.has(rule.type)||rule.type==='merge_queue'))return null;
   phase='topology';const evidence=verifiedUnstackedTopologySchema.parse(await bounded(()=>deps.readTopologyEvidence!(structuredClone(plan),signal)));
   if(evidence.organizationId!==plan.organizationId||evidence.connectionId!==plan.connectionId||evidence.connectionRevision!==plan.connectionRevision||evidence.repositoryFullName!==plan.pullRequest.repositoryFullName||evidence.pullRequestNumber!==plan.pullRequest.number||evidence.headSha!==plan.pullRequest.headSha||evidence.baseSha!==plan.pullRequest.baseSha||Date.parse(evidence.observedAt)>now()||now()-Date.parse(evidence.observedAt)>30000||Date.parse(evidence.expiresAt)<=now()||Date.parse(evidence.expiresAt)>now()+30000)return null;
   phase='final_authority';await current();guard();if(Date.parse(evidence.expiresAt)<=now()||now()-Date.parse(evidence.observedAt)>30000)return null;
   const support:DirectMergeSupport={organizationId:plan.organizationId,connectionId:plan.connectionId,connectionRevision:plan.connectionRevision,repositoryFullName:plan.pullRequest.repositoryFullName,pullRequestNumber:plan.pullRequest.number,headSha:plan.pullRequest.headSha,baseSha:plan.pullRequest.baseSha,mergeQueueRequired:false,stacked:false,sourcePolicy:'expected_head_observed_base'};
   verifiedSupportEvidence.set(support,{planDigest:sha256ContentHash(plan),credentialDigest:sha256ContentHash(credential),supportDigest:sha256ContentHash(support),sourceDigest:sha256ContentHash({repository:r,pullRequest:pr,rules,topology:evidence}),observedAt:evidence.observedAt,expiresAt:evidence.expiresAt});
   verified=true;return support;
  }catch{return null}finally{try{deps.onDiagnostic?.({phase,outcome:verified?'verified':signal.aborted||now()>=deadline?'deadline_or_abort':'refused'})}catch{/* Diagnostics never change authorization or results. */}clearTimeout(timer);controller.abort()}
 };
}
