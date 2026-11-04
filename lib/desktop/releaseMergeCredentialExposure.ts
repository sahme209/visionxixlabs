import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import type {ReleaseProviderMergeStore,ProviderMergeScope} from '@/lib/tauri/releaseProviderMergeStore';
import type {ProviderMergeCredential,ProviderMergeTransportPorts} from '@/lib/tauri/releaseProviderMergeTransport';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {createReleaseCredentialExposureStore,type ReleaseCredentialExposureBinding} from '@/lib/governance/intelligence/releaseCredentialExposureStore';
import {readEnrollmentDrainBarrierLocked} from '@/lib/governance/intelligence/enrollmentDrainStore';
import {captureCurrentDesktopSessionFreshness} from './currentSessionFreshness';
const credentialSchema=z.object({organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string(),repositoryFullName:z.string(),installationId:z.string(),token:z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f-\x9f]+$/),expiresAt:z.number().finite().int().safe(),contentsWrite:z.literal(true),pullRequestsRead:z.literal(true)}).strict();
/** One request/operation's private credential. No token enters a durable row or
 * client DTO. A failed/unknown first issuance is retained, never reminted. */
export function createReleaseMergeCredentialExposure(repo:ReleaseOperationPlanRepo,rawScope:ProviderMergeScope,operationId:string,store:Pick<ReleaseProviderMergeStore,'assertClaimedCredentialAuthority'>,deps:{now?:()=>number;signal:AbortSignal;isEnabled:()=>boolean;readCredential:NonNullable<ProviderMergeTransportPorts['readCredential']>}){
 const now=deps.now??(()=>Date.now()),scope=structuredClone(rawScope),isEnabled=deps.isEnabled,readCredential=deps.readCredential,parent=deps.signal,cache=new Map<string,{signal:AbortSignal;value:Promise<{credential:ProviderMergeCredential;assertOriginalFresh:()=>void}|null>}>;
 return async(raw:Readonly<ReleaseOperationPlan>,callerSignal:AbortSignal):Promise<ProviderMergeCredential|null>=>{
  const plan=parseReleaseOperationPlan(raw),signal=AbortSignal.any([parent,callerSignal]);
  const ready=()=>{signal.throwIfAborted();if(!isEnabled()||plan.organizationId!==scope.organizationId)throw Error('release_merge_credential_unavailable')};
  async function current(tx:Tx,open:boolean){
   ready();const claimed=await store.assertClaimedCredentialAuthority(tx,scope,operationId,plan);
   const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;githubInstallationId:string;accountLogin:string;status:string;updatedAt:Date;revokedAt:Date|null;suspendedAt:Date|null}>>`SELECT "id","organizationId","githubInstallationId","accountLogin","status","updatedAt","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "id"=${plan.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
   const row=rows[0];if(rows.length!==1||!row||row.id!==plan.connectionId||row.organizationId!==scope.organizationId||row.status!=='active'||row.revokedAt||row.suspendedAt||!(row.updatedAt instanceof Date)||row.updatedAt.toISOString()!==plan.connectionRevision||row.accountLogin.toLowerCase()!==plan.pullRequest.repositoryFullName.split('/')[0].toLowerCase()||!(/^[1-9][0-9]{0,14}$/.test(row.githubInstallationId)))throw Error('release_merge_credential_unavailable');
   const session=await captureCurrentDesktopSessionFreshness(tx,scope,signal,now);
   if(open){const barrier=await readEnrollmentDrainBarrierLocked(tx,scope.organizationId,signal);if(barrier&&barrier.status!=='aborted')throw Error('release_merge_credential_unavailable')}
   const binding:ReleaseCredentialExposureBinding={purpose:'release_merge',repositoryFullName:plan.pullRequest.repositoryFullName,connectionId:plan.connectionId,githubInstallationId:row.githubInstallationId,connectionRevision:plan.connectionRevision,planDigest:hash(plan),sourceDigest:hash({headSha:plan.pullRequest.headSha,baseSha:plan.pullRequest.baseSha,baseRef:plan.pullRequest.baseRef,sourcePolicy:'expected_head_observed_base',method:plan.method})};
   const fresh=()=>{ready();claimed();session()};fresh();return{binding,fresh};
  }
  async function readCurrent(open:boolean){const result=await repo.$transaction(tx=>current(tx,open));result.fresh();return result}
  async function issue(){
   try{ready();const first=await readCurrent(true),ledger=createReleaseCredentialExposureStore(repo,{signal,assertCurrent:async(tx,s,b)=>{if(hash(s)!==hash(scope))throw Error('release_merge_credential_unavailable');const checked=await current(tx,false);if(hash(b)!==hash(checked.binding)||hash(b)!==hash(first.binding))throw Error('release_merge_credential_unavailable');return checked.fresh}});
    const pending=await ledger.reserve(scope,first.binding,randomUUID());const authorized=await readCurrent(true);authorized.fresh();
    const rawCredential=await readCredential(structuredClone(plan),signal);if(!rawCredential)return null;const c=credentialSchema.parse(rawCredential);
    if(c.organizationId!==scope.organizationId||c.connectionId!==first.binding.connectionId||c.connectionRevision!==first.binding.connectionRevision||c.repositoryFullName!==first.binding.repositoryFullName||c.installationId!==first.binding.githubInstallationId||c.expiresAt<=now()+20000||c.expiresAt>now()+65*60000)throw Error('release_merge_credential_unavailable');
    await ledger.finalize(scope,pending.id,c.expiresAt);const final=await readCurrent(true);if(hash(final.binding)!==hash(first.binding))throw Error('release_merge_credential_unavailable');final.fresh();return{credential:c,assertOriginalFresh:final.fresh};
   }catch{return null}
  }
  try{ready();const key=hash(plan);let entry=cache.get(key);if(!entry){entry={signal,value:issue()};cache.set(key,entry)}entry.signal.throwIfAborted();const issued=await entry.value;entry.signal.throwIfAborted();if(!issued)return null;issued.assertOriginalFresh();const credential=issued.credential,final=await readCurrent(true);if(credential.installationId!==final.binding.githubInstallationId||credential.expiresAt<=now()+20000)throw Error('release_merge_credential_unavailable');entry.signal.throwIfAborted();issued.assertOriginalFresh();final.fresh();return structuredClone(credential)}catch{return null}
 };
}
