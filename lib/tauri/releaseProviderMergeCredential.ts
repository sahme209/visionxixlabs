import 'server-only';
import {z} from 'zod';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from './releaseOperationPlanContract';
import {parseRepositoryFullName} from '@/lib/connectors/github/repositoryFullName';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {ProviderMergeCredential} from './releaseProviderMergeTransport';
const key=z.string().min(1).max(240),instant=z.string().datetime(),installationId=z.string().regex(/^[1-9][0-9]{0,19}$/);
const installationSchema=z.object({id:key,organizationId:key,githubInstallationId:installationId,accountLogin:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/),status:z.literal('active'),updatedAt:z.date(),revokedAt:z.null(),suspendedAt:z.null()}).strict();
export interface ProviderMergeAppAuthorizationBinding{organizationId:string;connectionId:string;connectionRevision:string;installationId:string}
const authorizationSchema=z.object({organizationId:key,connectionId:key,connectionRevision:instant,installationId,jwt:z.string().min(1).max(16384).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),expiresAt:z.number().finite()}).strict();
const tokenResponseSchema=z.object({token:z.string().min(1).max(4096).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v)),expires_at:instant,permissions:z.object({contents:z.literal('write'),pull_requests:z.literal('read'),metadata:z.literal('read')}).strict(),repository_selection:z.literal('selected'),repositories:z.array(z.object({name:z.string(),full_name:z.string(),owner:z.object({login:z.string()}).passthrough()}).passthrough()).length(1)}).passthrough();
export interface ProviderMergeCredentialDependencies{
 isEnabled?:()=>boolean;
 assertCurrent?:(plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal)=>Promise<void|(()=>void)>;
 /** Project exactly the active tenant GitHubInstallation fields; never select a host/default installation. */
 readInstallation?:(input:{organizationId:string;connectionId:string},signal:AbortSignal)=>Promise<unknown>;
 /** Trusted server JWT signer/config boundary. It must never accept client-supplied App material. */
 readAppAuthorization?:(binding:Readonly<ProviderMergeAppAuthorizationBinding>,signal:AbortSignal)=>Promise<unknown>;
 fetch?:typeof fetch;
 now?:()=>number;
}
/** Distinct merge-only token mint. No legacy read token/cache or ambient credential fallback. */
export function createReleaseProviderMergeCredentialReader(deps:ProviderMergeCredentialDependencies={}){
 return async(rawPlan:Readonly<ReleaseOperationPlan>,inputSignal:AbortSignal):Promise<ProviderMergeCredential|null>=>{
  if(!deps.isEnabled?.()||!deps.assertCurrent||!deps.readInstallation||!deps.readAppAuthorization||!deps.fetch||inputSignal.aborted)return null;
  const now=deps.now??Date.now,deadline=now()+8000,controller=new AbortController(),signal=AbortSignal.any([inputSignal,controller.signal]),timer=setTimeout(()=>controller.abort(),8000);
  let currentFresh:(()=>void)|undefined;const guard=()=>{signal.throwIfAborted();const at=now();if(!Number.isFinite(at)||!Number.isFinite(deadline)||at>=deadline||!deps.isEnabled?.())throw Error('merge_credential_unavailable');currentFresh?.()};
  const bounded=async<T>(fn:()=>Promise<T>)=>{guard();const value=await withGithubAbort(Promise.resolve().then(()=>{guard();return fn()}),signal);guard();return value};
  try{
   const plan=parseReleaseOperationPlan(rawPlan),repo=parseRepositoryFullName(plan.pullRequest.repositoryFullName);if(!repo)return null;
   const authority=async()=>{const fresh=await bounded(()=>deps.assertCurrent!(structuredClone(plan),signal));if(fresh!==undefined&&typeof fresh!=='function')throw Error('merge_credential_unavailable');if(typeof fresh==='function'){const prior=currentFresh;currentFresh=()=>{prior?.();if(fresh()!==undefined)throw Error('merge_credential_unavailable')}}guard()};
   const read=async()=>{const row=installationSchema.parse(await bounded(()=>deps.readInstallation!({organizationId:plan.organizationId,connectionId:plan.connectionId},signal)));if(row.id!==plan.connectionId||row.organizationId!==plan.organizationId||row.updatedAt.getTime()!==Date.parse(plan.connectionRevision)||row.accountLogin.toLowerCase()!==repo.owner.toLowerCase())throw Error('merge_installation_changed');return row};
   await authority();const before=await read(),binding={organizationId:plan.organizationId,connectionId:plan.connectionId,connectionRevision:plan.connectionRevision,installationId:before.githubInstallationId};
   const auth=authorizationSchema.parse(await bounded(()=>deps.readAppAuthorization!(binding,signal)));if(auth.organizationId!==binding.organizationId||auth.connectionId!==binding.connectionId||auth.connectionRevision!==binding.connectionRevision||auth.installationId!==binding.installationId||auth.expiresAt<=now()+8000)return null;
   await authority();const preflight=await read();if(preflight.githubInstallationId!==before.githubInstallationId)return null;
   const url=`https://api.github.com/app/installations/${before.githubInstallationId}/access_tokens`,fetching=Promise.resolve().then(()=>{guard();return deps.fetch!(url,{method:'POST',headers:{Authorization:`Bearer ${auth.jwt}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify({repositories:[repo.repo],permissions:{contents:'write',pull_requests:'read',metadata:'read'}}),signal,redirect:'error',credentials:'omit',cache:'no-store'})});
   void fetching.then(response=>{if(signal.aborted||now()>=deadline)void response.body?.cancel().catch(()=>{})},()=>{});
   const response=await bounded(()=>fetching);
   if(response.url&&response.url!==url||response.redirected||response.status!==201){void response.body?.cancel().catch(()=>{});return null}
   const bytes=await bounded(()=>readBoundedGithubBody(response,signal,65536)),token=tokenResponseSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))),granted=token.repositories[0],expiresAt=Date.parse(token.expires_at);
   if(granted.full_name!==plan.pullRequest.repositoryFullName||granted.name!==repo.repo||granted.owner.login.toLowerCase()!==repo.owner.toLowerCase()||expiresAt<=now()+20000||expiresAt>now()+65*60000)return null;
   await authority();const after=await read();if(after.githubInstallationId!==before.githubInstallationId||expiresAt<=now()+20000)return null;guard();
   return {organizationId:plan.organizationId,connectionId:plan.connectionId,connectionRevision:plan.connectionRevision,repositoryFullName:plan.pullRequest.repositoryFullName,installationId:before.githubInstallationId,token:token.token,expiresAt,contentsWrite:true,pullRequestsRead:true};
  }catch{return null}finally{clearTimeout(timer);controller.abort()}
 };
}
