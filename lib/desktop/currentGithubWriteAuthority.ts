import 'server-only';
import {hasDesktopCapability,type DesktopWorkspaceRole,type DesktopCapability} from './desktopAuthorization';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {NextRequest} from 'next/server';
import {resolveRequestDesktopSession,type DesktopRequestPrincipal} from './resolveRequestDesktopSession';
import {assertNoGovernanceEnrollmentForMutation,type GovernanceEnrollmentMetadataRepo} from '@/lib/governance/intelligence/enrollmentMetadata';
import {resolveTenantScopedToken,type InstallationRepo,type RepoRef} from '@/lib/connectors/github/resolveTenantScopedToken';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
/** Current paired actor and captured installation for legacy writes only.
 * Resolves existing connection credentials; never baseline admission or coverage. */
export function createCurrentGithubWriteGuard(request:NextRequest,initial:DesktopRequestPrincipal,repo:GovernanceEnrollmentMetadataRepo&InstallationRepo&Pick<ReleaseOperationPlanTransaction,'$queryRaw'>,profile:'repository_write'|'deployment_dispatch'|'production_bypass_dispatch'='repository_write'){
 const required:readonly DesktopCapability[]|null=profile==='repository_write'?['github:write']:profile==='deployment_dispatch'?['deploy:execute']:profile==='production_bypass_dispatch'?['deploy:execute','deploy:production_bypass']:null;
 const bound={id:initial.id,userId:initial.userId,organizationId:initial.organizationId,credentialKind:initial.credentialKind};
 let pinned:{id:string;githubInstallationId:string;updatedAt:Date}|undefined;
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
 async function current(){
  signal.throwIfAborted();if(!required)throw Error('github_write_authority_unavailable');
  const actor=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:required[0],requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'github mutation current authority'}),signal);
  if(bound.credentialKind!=='desktop_session'||!bound.id||!bound.userId||!bound.organizationId||!actor||actor.credentialKind!=='desktop_session'||actor.id!==bound.id||actor.userId!==bound.userId||actor.organizationId!==bound.organizationId||!required.every(capability=>actor.capabilities?.includes(capability)))throw Error('github_write_authority_unavailable');
  signal.throwIfAborted();
 }
 async function installation(){
  signal.throwIfAborted();
  const row=await withGithubAbort(repo.gitHubInstallation.findFirst({where:{organizationId:bound.organizationId,status:'active'},orderBy:{installedAt:'desc'},select:{id:true,githubInstallationId:true,updatedAt:true,revokedAt:true,suspendedAt:true}}),signal);
  if(!row||typeof row.id!=='string'||!row.id||! /^[1-9][0-9]*$/.test(row.githubInstallationId)||!Number.isSafeInteger(Number(row.githubInstallationId))||!(row.updatedAt instanceof Date)||!Number.isFinite(row.updatedAt.getTime())||row.revokedAt!==null||row.suspendedAt!==null)throw Error('github_write_authority_unavailable');
  if(pinned&&(row.id!==pinned.id||row.githubInstallationId!==pinned.githubInstallationId||row.updatedAt.getTime()!==pinned.updatedAt.getTime()))throw Error('github_write_authority_unavailable');
  pinned??=Object.freeze({id:row.id,githubInstallationId:row.githubInstallationId,updatedAt:new Date(row.updatedAt.getTime())});
  signal.throwIfAborted();
 }
 async function snapshot(){
  if(!pinned)throw Error('github_write_authority_unavailable');
  // One statement observes persisted actor, installation and enrollment at the
  // same MVCC snapshot. No provider traffic or subsequent authority await here.
  const rows=await withGithubAbort(repo.$queryRaw<Array<{
   sessionId:string;userId:string;organizationId:string;sessionLive:boolean;role:string;acceptedAt:Date|null;
   connectionId:string;githubInstallationId:string;connectionRevision:Date;connectionRevokedAt:Date|null;connectionSuspendedAt:Date|null;connectionStatus:string;enrolled:boolean;
  }>>`SELECT s."id" AS "sessionId", s."userId", s."organizationId",
   (s."revokedAt" IS NULL AND s."expiresAt" > clock_timestamp()) AS "sessionLive", m."role", m."acceptedAt",
   i."id" AS "connectionId", i."githubInstallationId", i."updatedAt" AS "connectionRevision",
   i."revokedAt" AS "connectionRevokedAt", i."suspendedAt" AS "connectionSuspendedAt", i."status" AS "connectionStatus",
   EXISTS (SELECT 1 FROM "DurableAgentWorkflow" d WHERE d."organizationId"=s."organizationId" AND (d."workflowKind"='governance_baseline_active_v1' OR left(d."id",18)='governance_active_')) AS "enrolled"
   FROM "DesktopSessionRecord" s JOIN "OrgMembership" m ON m."organizationId"=s."organizationId" AND m."userId"=s."userId"
   JOIN "GitHubInstallation" i ON i."organizationId"=s."organizationId" AND i."id"=${pinned.id}
   WHERE s."id"=${bound.id} AND s."organizationId"=${bound.organizationId} AND s."userId"=${bound.userId}
   AND i."id"=(SELECT latest."id" FROM "GitHubInstallation" latest WHERE latest."organizationId"=${bound.organizationId} AND latest."status"='active' ORDER BY latest."installedAt" DESC LIMIT 1)`,signal);
  const row=rows[0];
  if(rows.length!==1||!row||row.sessionId!==bound.id||row.userId!==bound.userId||row.organizationId!==bound.organizationId||row.sessionLive!==true||!(row.acceptedAt instanceof Date)||!Number.isFinite(row.acceptedAt.getTime())||!['owner','admin','operator','security_reviewer','finance_viewer','read_only'].includes(row.role)||!required||!required.every(capability=>hasDesktopCapability(row.role as DesktopWorkspaceRole,capability))||row.connectionId!==pinned.id||row.githubInstallationId!==pinned.githubInstallationId||!(row.connectionRevision instanceof Date)||row.connectionRevision.getTime()!==pinned.updatedAt.getTime()||row.connectionRevokedAt!==null||row.connectionSuspendedAt!==null||row.connectionStatus!=='active'||row.enrolled!==false)throw Error('github_write_authority_unavailable');
  signal.throwIfAborted();
 }
 const beforeWrite=async()=>{await current();await installation();await assertNoGovernanceEnrollmentForMutation(repo,bound.organizationId,signal);await current();await snapshot()};
 return Object.freeze(Object.assign(beforeWrite,{
  async resolveToken(repository:RepoRef){
   try{
    signal.throwIfAborted();if(!pinned)throw Error('github_write_authority_unavailable');
    const target={owner:repository.owner,repo:repository.repo};
    const result=await withGithubAbort(resolveTenantScopedToken(bound.organizationId,target,{id:pinned.id,githubInstallationId:pinned.githubInstallationId,updatedAt:new Date(pinned.updatedAt.getTime()),signal},repo),signal);
    if(!result.ok)return result;
    await beforeWrite();return result;
   }catch{return{ok:false as const,error:'github_write_authority_unavailable' as const}}
  },
 }));
}
