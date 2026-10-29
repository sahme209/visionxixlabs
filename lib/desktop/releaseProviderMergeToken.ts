import 'server-only';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {parseRepositoryFullName} from '@/lib/connectors/github/resolveTenantScopedToken';
import {resolveReleaseInstallationToken} from '@/lib/connectors/github/githubAppAuth';
import type {ProviderMergeCredential} from '@/lib/tauri/releaseProviderMergeTransport';
export interface MergeTokenPorts{
 isEnabled:()=>boolean;
 assertCurrent:(plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal)=>Promise<void>;
 readInstallation:(organizationId:string,connectionId:string,signal:AbortSignal)=>Promise<{id:string;organizationId:string;githubInstallationId:string;accountLogin:string;status:string;updatedAt:Date;revokedAt:Date|null;suspendedAt:Date|null}|null>;
 fetch:typeof fetch;
}
/** Reuses the private GitHub App signer. No JWT leaves its existing module. */
function boundToken(ports:MergeTokenPorts,purpose:'merge'|'merge_policy_read'){
 return async(raw:Readonly<ReleaseOperationPlan>,signal:AbortSignal)=>{
  try{
   const plan=parseReleaseOperationPlan(raw),repository=parseRepositoryFullName(plan.pullRequest.repositoryFullName);if(!repository||!ports.isEnabled())return null;
   const check=async()=>{signal.throwIfAborted();if(!ports.isEnabled())throw Error('provider_merge_unavailable');await ports.assertCurrent(plan,signal);const row=await ports.readInstallation(plan.organizationId,plan.connectionId,signal);if(!row||row.id!==plan.connectionId||row.organizationId!==plan.organizationId||row.status!=='active'||row.revokedAt||row.suspendedAt||row.updatedAt.toISOString()!==plan.connectionRevision||row.accountLogin.toLowerCase()!==repository.owner.toLowerCase()||!/^\d{1,15}$/.test(row.githubInstallationId))throw Error('provider_merge_connection_changed');return row};
   const row=await check();const assertCurrent=async()=>{if((await check()).githubInstallationId!==row.githubInstallationId)throw Error('provider_merge_connection_changed')};
   const token=await resolveReleaseInstallationToken({installationId:row.githubInstallationId,repositoryFullName:plan.pullRequest.repositoryFullName,purpose,isEnabled:ports.isEnabled,assertCurrent,fetch:ports.fetch},signal);if(!token)return null;await assertCurrent();return{plan,row,token};
  }catch{return null}
 };
}
export function createReleaseProviderMergeToken(ports:MergeTokenPorts){const read=boundToken(ports,'merge');return async(raw:Readonly<ReleaseOperationPlan>,signal:AbortSignal):Promise<ProviderMergeCredential|null>=>{const result=await read(raw,signal);if(!result)return null;const{plan,row,token}=result;return{organizationId:plan.organizationId,connectionId:plan.connectionId,connectionRevision:plan.connectionRevision,repositoryFullName:plan.pullRequest.repositoryFullName,installationId:row.githubInstallationId,token:token.token,expiresAt:token.expiresAt,contentsWrite:true,pullRequestsRead:true}}}
export function createReleaseMergePolicyCredential(ports:MergeTokenPorts){const read=boundToken(ports,'merge_policy_read');return async(raw:Readonly<ReleaseOperationPlan>,signal:AbortSignal)=>{const result=await read(raw,signal);if(!result)return null;const{plan,token}=result;return{organizationId:plan.organizationId,connectionId:plan.connectionId,connectionRevision:plan.connectionRevision,repositoryFullName:plan.pullRequest.repositoryFullName,token:token.token,expiresAt:token.expiresAt,permissions:token.permissions}}}
