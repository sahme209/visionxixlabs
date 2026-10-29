import 'server-only';
import { z } from 'zod';
import { deploymentPlanSchema, type DeploymentPlan } from './releaseDeploymentExecutionContract';
import { sha256ContentHash } from './contentHash';
import { readBoundedGithubBody, withGithubAbort } from '@/lib/connectors/github/boundedGithubRead';

export const PROTECTED_TAG_POLICY = 'github_protected_tag_v1';
const credentialSchema = z.object({
  organizationId:z.string(), connectionId:z.string(), connectionRevision:z.string().datetime(),
  repositoryFullName:z.string(), installationId:z.string(), token:z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/),
  expiresAt:z.number().finite(),
  permissions:z.object({contents:z.literal('read'),administration:z.literal('read'),metadata:z.literal('read')}).strict(),
}).strict();
export interface ProtectedTagDependencies {
  isEnabled?:()=>boolean;
  assertCurrent?:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>Promise<void>;
  /** Dedicated repository-scoped read token. Never reuse a dispatch/admin-write token. */
  readCredential?:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>Promise<unknown>;
  fetch?:typeof fetch;
  now?:()=>number;
}
const ruleSchema=z.object({id:z.number().int().positive(),name:z.string(),target:z.enum(['branch','tag']),source_type:z.literal('Repository'),source:z.string(),enforcement:z.enum(['active','disabled','evaluate']),bypass_actors:z.array(z.unknown()).max(0),conditions:z.object({ref_name:z.object({include:z.array(z.string()).min(1).max(20),exclude:z.array(z.string()).max(0)}).strict()}).strict(),rules:z.array(z.object({type:z.enum(['creation','update','deletion','required_signatures'])}).strict()).max(20)}).passthrough();

/** Narrow supported policy: immutable lightweight tag + blocked same-name branch creation.
 * Missing bypass visibility, inherited/unknown rules or any ambiguous provider read refuses.
 * This proves provider-enforced ref restrictions, not an atomic mutable-ref preflight.
 * Authorized administrators changing those restrictions remain outside this token's authority.
 */
export function createProtectedTagPolicyReader(deps:ProtectedTagDependencies={}) {
 return async (raw:Readonly<DeploymentPlan>, inputSignal:AbortSignal) => {
  if(!deps.isEnabled?.()||!deps.assertCurrent||!deps.readCredential||!deps.fetch||inputSignal.aborted)return null;
  const now=deps.now??Date.now,deadline=now()+12000;
  const controller=new AbortController(),signal=AbortSignal.any([inputSignal,controller.signal]);
  const timer=setTimeout(()=>controller.abort(),12000);
  const guard=()=>{signal.throwIfAborted();if(!deps.isEnabled?.()||!Number.isFinite(now())||now()>=deadline)throw Error('release_source_policy_unavailable')};
  const bounded=async<T>(fn:()=>Promise<T>)=>{guard();const value=await withGithubAbort(Promise.resolve().then(fn),signal);guard();return value};
  try {
   const plan=deploymentPlanSchema.parse(raw);
   if(plan.sourcePolicy!==PROTECTED_TAG_POLICY||plan.refKind!=='tag'||!/^axiom-release-[A-Za-z0-9_-]{1,100}$/.test(plan.ref))return null;
   const credential=credentialSchema.parse(await bounded(()=>deps.readCredential!(structuredClone(plan),signal)));
   const current=async()=>{
    await bounded(()=>deps.assertCurrent!(structuredClone(plan),signal));
    if(credential.organizationId!==plan.organizationId||credential.connectionId!==plan.connectionId||credential.connectionRevision!==plan.connectionRevision||credential.repositoryFullName!==plan.repositoryFullName||credential.installationId!==plan.installationId||credential.expiresAt<=now()+20000||now()>=Date.parse(plan.expiresAt))throw Error('release_source_policy_unavailable');
   };
   const base=`https://api.github.com/repos/${plan.repositoryFullName.split('/').map(encodeURIComponent).join('/')}`;
   const budget={remainingBytes:256*1024};
   async function get(path:string,allowNotFound=false):Promise<unknown>{
    await current();const url=base+path;
    const pending=Promise.resolve().then(()=>{guard();return deps.fetch!(url,{method:'GET',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${credential.token}`,'X-GitHub-Api-Version':'2022-11-28'},redirect:'error',credentials:'omit',cache:'no-store',signal})});
    void pending.then(r=>{if(signal.aborted||now()>=deadline)void r.body?.cancel().catch(()=>{})},()=>{});
    const response=await bounded(()=>pending);
    if(response.redirected||response.url&&response.url!==url||response.headers.has('link')){void response.body?.cancel().catch(()=>{});throw Error('release_source_policy_incomplete')}
    if(allowNotFound&&response.status===404){void response.body?.cancel().catch(()=>{});await current();return null}
    if(response.status!==200){void response.body?.cancel().catch(()=>{});throw Error('release_source_policy_incomplete')}
    const bytes=await bounded(()=>readBoundedGithubBody(response,signal,128*1024,budget));
    const data:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await current();return data;
   }
   await current();
   const repository=z.object({full_name:z.string(),archived:z.literal(false),disabled:z.literal(false)}).passthrough().parse(await get(''));
   if(repository.full_name!==plan.repositoryFullName)return null;
   const tag=z.object({ref:z.string(),object:z.object({type:z.literal('commit'),sha:z.string().regex(/^[a-f0-9]{40}$/)}).passthrough()}).passthrough().parse(await get(`/git/ref/tags/${encodeURIComponent(plan.ref)}`));
   if(tag.ref!==`refs/tags/${plan.ref}`||tag.object.sha!==plan.sourceCommitSha)return null;
   if(await get(`/git/ref/heads/${encodeURIComponent(plan.ref)}`,true)!==null)return null;
   const list=z.array(z.object({id:z.number().int().positive()}).passthrough()).max(16).parse(await get('/rulesets?includes_parents=true&per_page=100&page=1'));
   if(new Set(list.map(r=>r.id)).size!==list.length)return null;
   const rules:z.infer<typeof ruleSchema>[]=[];
   for(const item of list){const rule=ruleSchema.parse(await get(`/rulesets/${item.id}`));if(rule.id!==item.id)return null;rules.push(rule);}
   if(rules.some(r=>r.source!==plan.repositoryFullName))return null;
   const protects=(target:'tag'|'branch',types:string[])=>rules.some(r=>r.enforcement==='active'&&r.target===target&&r.conditions.ref_name.include.length===1&&r.conditions.ref_name.include[0]===`refs/${target==='tag'?'tags':'heads'}/${plan.ref}`&&types.every(type=>r.rules.some(rule=>rule.type===type)));
   if(!protects('tag',['update','deletion'])||!protects('branch',['creation']))return null;
   // Re-read the exact ref after policy reads; no mutable-ref fallback.
   const final=z.object({ref:z.string(),object:z.object({type:z.literal('commit'),sha:z.string()}).passthrough()}).passthrough().parse(await get(`/git/ref/tags/${encodeURIComponent(plan.ref)}`));
   if(final.ref!==tag.ref||final.object.sha!==plan.sourceCommitSha)return null;
   await current();guard();
   return {proof:{kind:'verified_release_deployment_source_policy_v1' as const,planDigest:sha256ContentHash(plan),sourcePolicy:PROTECTED_TAG_POLICY},evidence:{repositoryFullName:plan.repositoryFullName,ref:tag.ref,sourceCommitSha:plan.sourceCommitSha,rulesetIds:rules.map(r=>r.id),policyDigest:sha256ContentHash(rules),observedAt:new Date(now()).toISOString(),expiresAt:new Date(Math.min(deadline,credential.expiresAt-20000,Date.parse(plan.expiresAt))).toISOString()}};
  } catch { return null; } finally {clearTimeout(timer);controller.abort()}
 };
}
