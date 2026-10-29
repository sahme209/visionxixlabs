import 'server-only';
import { z } from 'zod';
import { deploymentPlanSchema, type DeploymentPlan } from './releaseDeploymentExecutionContract';
import { sha256ContentHash } from './contentHash';
import { readBoundedGithubBody, withGithubAbort } from '@/lib/connectors/github/boundedGithubRead';

export const IMMUTABLE_RELEASE_POLICY = 'github_immutable_release_v1';
const credentialSchema = z.object({
  organizationId:z.string(), connectionId:z.string(), connectionRevision:z.string().datetime(),
  repositoryFullName:z.string(), installationId:z.string(), token:z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/),
  expiresAt:z.number().finite(),
  permissions:z.object({contents:z.literal('read'),administration:z.literal('read'),metadata:z.literal('read')}).strict(),
}).strict();
export interface ImmutableReleaseDependencies {
  /** Source observation only; consumers must not install a dispatch transport. */
  readPurpose?:'execution'|'observation';
  onRefusal?:(code:'release_immutable_required')=>void;
  isEnabled?:()=>boolean;
  assertCurrent?:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>Promise<void>;
  /** Dedicated repository-scoped read token. Never reuse a dispatch/admin-write token. */
  readCredential?:(plan:Readonly<DeploymentPlan>,signal:AbortSignal)=>Promise<unknown>;
  fetch?:typeof fetch;
  now?:()=>number;
}


/** A separately named provider-enforced immutable-release proof. No ruleset bypass
 * assumptions or permission expansion. Published immutable release identity and
 * exact lightweight tag are checked before and after the bounded observation. */
export function createImmutableReleasePolicyReader(deps:ImmutableReleaseDependencies={}) {
 return async (raw:Readonly<DeploymentPlan>, inputSignal:AbortSignal) => {
  if(!deps.isEnabled?.()||!deps.assertCurrent||!deps.readCredential||!deps.fetch||inputSignal.aborted)return null;
  const now=deps.now??Date.now,deadline=now()+12000;
  const controller=new AbortController(),signal=AbortSignal.any([inputSignal,controller.signal]);
  const timer=setTimeout(()=>controller.abort(),12000);
  const guard=()=>{signal.throwIfAborted();if(!deps.isEnabled?.()||!Number.isFinite(now())||now()>=deadline)throw Error('release_source_policy_unavailable')};
  const bounded=async<T>(fn:()=>Promise<T>)=>{guard();const value=await withGithubAbort(Promise.resolve().then(fn),signal);guard();return value};
  try {
   const plan=deploymentPlanSchema.parse(raw);
   if(plan.sourcePolicy!==IMMUTABLE_RELEASE_POLICY||plan.refKind!=='tag'||!/^axiom-release-[A-Za-z0-9_-]{1,100}$/.test(plan.ref))return null;
   const credential=credentialSchema.parse(await bounded(()=>deps.readCredential!(structuredClone(plan),signal)));
   const current=async()=>{
    await bounded(()=>deps.assertCurrent!(structuredClone(plan),signal));
    if(credential.organizationId!==plan.organizationId||credential.connectionId!==plan.connectionId||credential.connectionRevision!==plan.connectionRevision||credential.repositoryFullName!==plan.repositoryFullName||credential.installationId!==plan.installationId||credential.expiresAt<=now()+20000||deps.readPurpose!=='observation'&&now()>=Date.parse(plan.expiresAt))throw Error('release_source_policy_unavailable');
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
   const releaseSchema=z.object({id:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),tag_name:z.literal(plan.ref),draft:z.literal(false),immutable:z.literal(true),published_at:z.string().datetime()}).passthrough();
   const rawRelease=await get(`/releases/tags/${encodeURIComponent(plan.ref)}`);
   if(rawRelease&&typeof rawRelease==='object'&&'immutable' in rawRelease&&rawRelease.immutable===false){deps.onRefusal?.('release_immutable_required');return null;}
   const release=releaseSchema.parse(rawRelease);
   // Re-read the exact ref after policy reads; no mutable-ref fallback.
   const final=z.object({ref:z.string(),object:z.object({type:z.literal('commit'),sha:z.string()}).passthrough()}).passthrough().parse(await get(`/git/ref/tags/${encodeURIComponent(plan.ref)}`));
   if(final.ref!==tag.ref||final.object.sha!==plan.sourceCommitSha)return null;
   const finalRelease=releaseSchema.parse(await get(`/releases/tags/${encodeURIComponent(plan.ref)}`));
   if(finalRelease.id!==release.id||finalRelease.published_at!==release.published_at)return null;
   await current();guard();
   // Network admission and the resulting read lease are separate clocks. A
   // successful bounded read receives its short observation lease now, rather
   // than consuming it while credentials/source reads are in flight. Dispatch
   // keeps the original absolute deadline and execution-window clamp.
   const observedAt=now(),proofDeadline=deps.readPurpose==='observation'?observedAt+12000:deadline;
   return {proof:{kind:'verified_release_deployment_source_policy_v1' as const,planDigest:sha256ContentHash(plan),sourcePolicy:IMMUTABLE_RELEASE_POLICY},evidence:{repositoryFullName:plan.repositoryFullName,ref:tag.ref,sourceCommitSha:plan.sourceCommitSha,releaseId:release.id,immutable:true as const,policyDigest:sha256ContentHash({releaseId:release.id,tag:tag.ref,sha:tag.object.sha,publishedAt:release.published_at}),observedAt:new Date(observedAt).toISOString(),expiresAt:new Date(Math.min(proofDeadline,credential.expiresAt-20000,deps.readPurpose==='observation'?Infinity:Date.parse(plan.expiresAt))).toISOString()}};
  } catch { return null; } finally {clearTimeout(timer);controller.abort()}
 };
}
