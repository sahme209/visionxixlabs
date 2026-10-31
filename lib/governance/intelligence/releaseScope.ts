import 'server-only';
import {z} from 'zod';
import {parseReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {parseDeploymentIntake} from '@/lib/tauri/deploymentIntakeSchema';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {identifier,scopeSchema} from './contracts';
import type {GovernanceAdmissionContext} from './admissionGuard';
const principal=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
const stored=z.object({id:identifier,organizationId:identifier,version:z.number().int().positive(),status:z.string(),intakeJson:z.unknown()}).strict();
/** Pure binding from already-authorized stored records, not an authority check.
 * Callers must load/recheck the reviewed plan and release under current tenant
 * authority. Neither a branch name nor a caller-provided scope supplies an
 * environment. Unsupported custom names refuse instead of guessing aliases. */
export function governanceContextFromReviewedRelease(input:{scope:unknown;row:unknown;plan:unknown}):GovernanceAdmissionContext{
 try{
  const s=principal.parse(input.scope),row=stored.parse(input.row),plan=parseReleaseOperationPlan(input.plan),intake=parseDeploymentIntake(row.intakeJson);
  if(!intake.ok||s.organizationId!==row.organizationId||s.organizationId!==plan.organizationId)throw Error();
  const rebuilt=buildReleaseMergePlan(row,{organizationId:s.organizationId,requestId:plan.requestId,expectedVersion:plan.requestVersion,expectedDigest:plan.intakeDigest,method:plan.method,observation:{connectionId:plan.connectionId,connectionRevision:plan.connectionRevision,repositoryFullName:plan.pullRequest.repositoryFullName,number:plan.pullRequest.number,headRepositoryFullName:plan.pullRequest.repositoryFullName,headRef:plan.pullRequest.headRef,headSha:plan.pullRequest.headSha,baseRef:plan.pullRequest.baseRef,baseSha:plan.pullRequest.baseSha,state:'open',draft:false,merged:false}});
  if(!rebuilt.ok||rebuilt.digest!==sha256ContentHash(plan))throw Error();
  const scope=scopeSchema.parse({repositoryId:plan.pullRequest.repositoryFullName,resourceId:'github:repository:'+plan.pullRequest.repositoryFullName,environment:intake.intake.targetEnvironment});
  return{...s,action:'repository.merge',scope,planDigest:rebuilt.digest};
 }catch{throw Error('governance_release_scope_unavailable')}
}
