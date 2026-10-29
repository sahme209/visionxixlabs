import 'server-only';
import {z} from 'zod';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from './releaseOperationPlanContract';
import {sha256ContentHash} from './contentHash';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
const sha=z.string().regex(/^[a-f0-9]{40}$/),repo=z.object({full_name:z.string()}).passthrough();
const credential=z.object({organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string(),repositoryFullName:z.string(),token:z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/),expiresAt:z.number().finite(),permissions:z.object({administration:z.literal('read'),contents:z.literal('read'),pull_requests:z.literal('read'),metadata:z.literal('read')}).strict()}).strict();
/** GitHub emits rel=first even for a complete one-page comparison. Never follow
 * it: admit only the exact first page for the already bound repository identity.
 * Completeness is independently required by the ancestry/count checks below. */
function completeCompareFirstLink(link:string,url:string,repositoryId:number|undefined){
 if(!Number.isSafeInteger(repositoryId)||!repositoryId||repositoryId<1)return false;
 const match=/^<([^<>\s]+)>;\s*rel="first"$/.exec(link);if(!match)return false;
 try{const expected=new URL(url),actual=new URL(match[1]);return actual.origin==='https://api.github.com'&&!actual.username&&!actual.password&&!actual.hash&&actual.pathname===expected.pathname.replace(/^\/repos\/[^/]+\/[^/]+/,`/repositories/${repositoryId}`)&&actual.searchParams.size===2&&actual.searchParams.get('per_page')==='100'&&actual.searchParams.get('page')==='1'}catch{return false}
}
export interface MergeTopologyPorts{onDiagnostic?:(event:{phase:'credential'|'authority'|'repository'|'compare'|'pull_requests'|'effective_rules'|'classic_protection'|'rulesets'|'final_reads';outcome:'verified'|'refused'|'deadline_or_abort'})=>void;policyMode?:'visible_rulesets'|'empty_effective_target';isEnabled?:()=>boolean;assertCurrent?:(p:Readonly<ReleaseOperationPlan>,s:AbortSignal)=>Promise<void>;readCredential?:(p:Readonly<ReleaseOperationPlan>,s:AbortSignal)=>Promise<unknown>;fetch?:typeof fetch;now?:()=>number}
/** Narrow observational topology proof, never an atomic expected-base guarantee.
 * Complete linear ancestry/open-PR reads plus an explicit supported policy are
 * mandatory. The empty-target mode proves no effective rules/classic protection;
 * it never treats hidden bypass metadata as empty. Other policy remains strict. */
export function createReleaseMergeTopologyReader(ports:MergeTopologyPorts={}){
 return async(raw:Readonly<ReleaseOperationPlan>,caller:AbortSignal)=>{
  if(!ports.isEnabled?.()||!ports.assertCurrent||!ports.readCredential||!ports.fetch||caller.aborted)return null;
  const now=ports.now??Date.now,deadline=now()+15000,controller=new AbortController(),signal=AbortSignal.any([caller,controller.signal]),timer=setTimeout(()=>controller.abort(),15000),budget={remainingBytes:384*1024};
  const guard=()=>{signal.throwIfAborted();if(!ports.isEnabled?.()||now()>=deadline||!Number.isFinite(now()))throw Error('merge_topology_unavailable')};
  const bounded=async<T>(fn:()=>Promise<T>)=>{guard();const r=await withGithubAbort(Promise.resolve().then(fn),signal);guard();return r};
  let phase:Parameters<NonNullable<MergeTopologyPorts['onDiagnostic']>>[0]['phase']='credential',verified=false;
  try{
   const p=parseReleaseOperationPlan(raw),c=credential.parse(await bounded(()=>ports.readCredential!(p,signal))),target=p.pullRequest;
   const current=async()=>{await bounded(()=>ports.assertCurrent!(p,signal));if(c.organizationId!==p.organizationId||c.connectionId!==p.connectionId||c.connectionRevision!==p.connectionRevision||c.repositoryFullName!==target.repositoryFullName||c.expiresAt<=now()+20000)throw Error('merge_topology_credential_changed')};
   let repositoryId:number|undefined;
   const base='https://api.github.com/repos/'+target.repositoryFullName.split('/').map(encodeURIComponent).join('/');
   async function get(path:string,allow404=false,completeCompare=false){await current();const url=base+path,response=await bounded(()=>ports.fetch!(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${c.token}`,'X-GitHub-Api-Version':'2022-11-28'}}));if(response.redirected||response.url&&response.url!==url||response.headers.has('link')&&!(completeCompare&&completeCompareFirstLink(response.headers.get('link')!,url,repositoryId))){void response.body?.cancel().catch(()=>{});throw Error('merge_topology_incomplete')}if(allow404&&response.status===404){void response.body?.cancel().catch(()=>{});await current();return null}if(response.status!==200){void response.body?.cancel().catch(()=>{});throw Error('merge_topology_incomplete')}const bytes=await bounded(()=>readBoundedGithubBody(response,signal,192*1024,budget));const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await current();return value}
   phase='repository';const repository=z.object({id:z.number().int().positive().safe().optional(),full_name:z.string(),default_branch:z.string(),archived:z.literal(false),disabled:z.literal(false)}).passthrough().parse(await get(''));if(repository.full_name!==target.repositoryFullName||repository.default_branch!==target.baseRef)return null;repositoryId=repository.id;
   phase='compare';const compare=z.object({status:z.literal('ahead'),ahead_by:z.number().int().min(1).max(50),behind_by:z.literal(0),total_commits:z.number().int().min(1).max(50),base_commit:z.object({sha}).passthrough(),merge_base_commit:z.object({sha}).passthrough(),commits:z.array(z.object({sha,parents:z.array(z.object({sha}).passthrough()).length(1)}).passthrough()).min(1).max(50)}).passthrough().parse(await get(`/compare/${target.baseSha}...${target.headSha}?per_page=100&page=1`,false,true));
   if(compare.base_commit.sha!==target.baseSha||compare.merge_base_commit.sha!==target.baseSha||compare.ahead_by!==compare.commits.length||compare.total_commits!==compare.commits.length)return null;
   let parent=target.baseSha;const commits=new Set<string>();for(const commit of compare.commits){if(commit.parents[0].sha!==parent||commits.has(commit.sha))return null;commits.add(commit.sha);parent=commit.sha}if(parent!==target.headSha)return null;
   const prSchema=z.array(z.object({number:z.number().int().positive(),state:z.literal('open'),draft:z.boolean(),head:z.object({sha,ref:z.string(),repo:repo.nullable()}).passthrough(),base:z.object({sha,ref:z.string(),repo}).passthrough()}).passthrough()).max(99);
   phase='pull_requests';const prs=prSchema.parse(await get('/pulls?state=open&per_page=100&page=1')),own=prs.filter(r=>r.number===target.number);if(own.length!==1||own[0].draft||own[0].head.sha!==target.headSha||own[0].head.ref!==target.headRef||own[0].head.repo?.full_name!==target.repositoryFullName||own[0].base.sha!==target.baseSha||own[0].base.ref!==target.baseRef||own[0].base.repo.full_name!==target.repositoryFullName)return null;
   if(prs.some(r=>!r.head.repo||r.base.repo.full_name!==target.repositoryFullName||r.number!==target.number&&(r.base.ref===target.headRef||commits.has(r.head.sha)||r.head.repo.full_name===target.repositoryFullName&&r.head.ref===target.headRef)))return null;
   const policy:unknown[]=[];
   const readEmptyTarget=async()=>{
    phase='effective_rules';const effective=z.array(z.unknown()).max(0).parse(await get(`/rules/branches/${encodeURIComponent(target.baseRef)}?per_page=100&page=1`));
    phase='classic_protection';if(await get(`/branches/${encodeURIComponent(target.baseRef)}/protection`,true)!==null)throw Error('merge_topology_protected_target_unsupported');
    return {kind:'empty_effective_target_v1',effective,classicProtection:null};
   };
   if(ports.policyMode==='empty_effective_target')policy.push(await readEmptyTarget());
   else {
   phase='rulesets';const rules=z.array(z.object({id:z.number().int().positive()}).passthrough()).max(16).parse(await get('/rulesets?includes_parents=true&per_page=100&page=1'));if(new Set(rules.map(r=>r.id)).size!==rules.length)return null;
   for(const rule of rules){const detail=z.object({id:z.number().int().positive(),source_type:z.literal('Repository'),source:z.string(),enforcement:z.enum(['active','disabled','evaluate']),target:z.enum(['branch','tag']),bypass_actors:z.array(z.unknown())}).passthrough().parse(await get(`/rulesets/${rule.id}`));if(detail.id!==rule.id||detail.source!==target.repositoryFullName||detail.enforcement==='active'&&detail.target==='branch'&&detail.bypass_actors.length)return null;policy.push(detail)}
   phase='classic_protection';const classic=await get(`/branches/${encodeURIComponent(target.baseRef)}/protection`,true);if(classic!==null){const protection=z.object({enforce_admins:z.object({enabled:z.literal(true)}).passthrough(),allow_force_pushes:z.object({enabled:z.literal(false)}).passthrough(),allow_deletions:z.object({enabled:z.literal(false)}).passthrough(),required_pull_request_reviews:z.object({bypass_pull_request_allowances:z.object({users:z.array(z.unknown()).max(0),teams:z.array(z.unknown()).max(0),apps:z.array(z.unknown()).max(0)}).passthrough()}).passthrough().nullable().optional()}).passthrough().parse(classic);policy.push(protection)}
   }
   phase='final_reads';const final=prSchema.parse(await get('/pulls?state=open&per_page=100&page=1'));if(sha256ContentHash(final)!==sha256ContentHash(prs))return null;if(ports.policyMode==='empty_effective_target'&&sha256ContentHash(await readEmptyTarget())!==sha256ContentHash(policy[0]))return null;await current();guard();
   verified=true;return {kind:'verified_unstacked_topology_v1' as const,organizationId:p.organizationId,connectionId:p.connectionId,connectionRevision:p.connectionRevision,repositoryFullName:target.repositoryFullName,pullRequestNumber:target.number,headSha:target.headSha,baseSha:target.baseSha,evidenceDigest:sha256ContentHash({compare,prs,policy}),observedAt:new Date(now()).toISOString(),expiresAt:new Date(Math.min(now()+10000,c.expiresAt-20000)).toISOString()};
  }catch{return null}finally{try{ports.onDiagnostic?.({phase,outcome:verified?'verified':signal.aborted||now()>=deadline?'deadline_or_abort':'refused'})}catch{/* Diagnostics never change authorization or results. */}clearTimeout(timer);controller.abort()}
 };
}
