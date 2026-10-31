import 'server-only';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import {RELEASE_PROVIDER_MERGE_KIND} from '@/lib/tauri/releaseProviderMergeKind';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {ProviderMergeScope,ReleaseProviderMergeStore} from '@/lib/tauri/releaseProviderMergeStore';
import {governanceContextFromReviewedRelease} from './releaseScope';
/** Trusted server-owned lookup, never a request-supplied repository/environment.
 * Existing store still rechecks/consumes exact authority atomically at claim.
 * This reader performs no provider I/O and cannot claim or approve an action. */
export function createGovernanceMergeBindingReader(repo:ReleaseOperationPlanRepo,store:Pick<ReleaseProviderMergeStore,'get'>,assertCurrent:(scope:ProviderMergeScope,signal:AbortSignal)=>Promise<void>){return async(rawScope:ProviderMergeScope,id:string,signal:AbortSignal)=>{
 const scope=structuredClone(rawScope);signal.throwIfAborted();if(!/^release_merge_provider_[a-f0-9]{64}$/.test(id))throw Error('governance_merge_binding_unavailable');
 await withGithubAbort(assertCurrent(scope,signal),signal);const record=await withGithubAbort(store.get(scope,id),signal);if(record.state!=='prepared'||record.attemptCount!==0||record.version!==0)throw Error('governance_merge_binding_unavailable');
 const result=await withGithubAbort(repo.$transaction(async tx=>{
  const row=await tx.durableAgentWorkflow.findFirst({where:{id,organizationId:scope.organizationId,workflowKind:RELEASE_PROVIDER_MERGE_KIND}}),binding=row?.inputJson as Record<string,unknown>|undefined;
  if(!row||row.id!==id||row.organizationId!==scope.organizationId||row.workflowKind!==RELEASE_PROVIDER_MERGE_KIND||row.version!==0||row.attemptCount!==0||!binding||binding.format!==1||binding.mode!=='provider'||sha256ContentHash(binding.scope)!==sha256ContentHash(scope)||typeof binding.planId!=='string'||binding.planVersion!==1||id!=='release_merge_provider_'+sha256ContentHash({organizationId:scope.organizationId,planId:binding.planId}))throw Error('governance_merge_binding_unavailable');
  const saved=await tx.durableAgentWorkflow.findFirst({where:{id:binding.planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}});
  if(!saved||saved.organizationId!==scope.organizationId||saved.workflowKind!==RELEASE_OPERATION_PLAN_KIND||saved.id!==binding.planId||saved.version!==1||saved.status!=='completed'||saved.currentStep!=='reviewed'||sha256ContentHash(saved.inputJson)!==sha256ContentHash(binding.planInput))throw Error('governance_merge_binding_unavailable');
  const input=parseReleaseOperationPlanInput(saved.inputJson);if(input.plan.organizationId!==scope.organizationId||input.planDigest!==sha256ContentHash(input.plan))throw Error('governance_merge_binding_unavailable');
  const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;status:string;intakeJson:unknown}>>`SELECT "id","organizationId","version","status","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${input.plan.requestId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  if(rows.length!==1)throw Error('governance_merge_binding_unavailable');const release=rows[0],context=governanceContextFromReviewedRelease({scope,row:release,plan:input.plan});return{context,plan:input.plan,release};
 }),signal);
 await withGithubAbort(assertCurrent(scope,signal),signal);signal.throwIfAborted();return structuredClone(result);
}};
