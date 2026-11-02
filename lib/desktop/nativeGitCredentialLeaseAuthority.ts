import 'server-only';
import {z} from 'zod';
import type {NextRequest} from 'next/server';
import {resolveRequestDesktopSession,type DesktopRequestPrincipal} from './resolveRequestDesktopSession';
import {hasDesktopCapability,type DesktopWorkspaceRole} from './desktopAuthorization';
import {isAgentGithubBranchReference} from '@/lib/tauri/agentGithubBranchReview';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {RevisionScope} from '@/lib/governance/intelligence/revisionStore';
const id=z.string().min(1).max(240).refine(v=>v.trim()===v&&!/[\x00-\x1f\x7f]/.test(v));
const scopeSchema=z.object({organizationId:id,actorUserId:id,sessionId:id}).strict();
const bindingSchema=z.object({
 repositoryFullName:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/),
 branch:z.string().refine(v=>isAgentGithubBranchReference(v)&&!v.includes('@{')&&!v.endsWith('.')),
 connectionId:id,githubInstallationId:z.string().regex(/^[1-9][0-9]{0,15}$/).refine(v=>Number.isSafeInteger(Number(v))),connectionRevision:z.string().datetime(),
}).strict();
export type NativeGitCredentialLeaseBinding=z.infer<typeof bindingSchema>;
/** DB-only current authority inside the lease store's existing transaction.
 * The store owns the organization lock and unenrolled decision. This helper
 * neither mints a token nor grants policy/branch authority or lease coverage. */
export function createNativeGitCredentialLeaseAuthority(request:NextRequest,initial:DesktopRequestPrincipal){
 const original={organizationId:initial.organizationId,actorUserId:initial.userId,sessionId:initial.id};
 const paired=initial.credentialKind==='desktop_session'&&Array.isArray(initial.capabilities)&&initial.capabilities.includes('github:write');
 return async(tx:ReleaseOperationPlanTransaction,rawScope:RevisionScope,rawBinding:NativeGitCredentialLeaseBinding):Promise<()=>void>=>{
  try{
   const scope=scopeSchema.parse(rawScope),bound=bindingSchema.parse(rawBinding),started=Date.now();
   const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
   const ready=()=>{signal.throwIfAborted();const at=Date.now();if(!Number.isFinite(started)||!Number.isFinite(at)||at<started||!paired||scope.organizationId!==original.organizationId||scope.actorUserId!==original.actorUserId||scope.sessionId!==original.sessionId)throw Error()};
   const current=async()=>{
    ready();const actor=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'github:write',requireWorkspaceMembership:true,requireActiveAccess:true,allowApiKey:false,recordHeartbeat:false,route:'native Git credential lease authority'}),signal);ready();
    if(!actor||actor.credentialKind!=='desktop_session'||actor.id!==scope.sessionId||actor.userId!==scope.actorUserId||actor.organizationId!==scope.organizationId||!actor.capabilities.includes('github:write'))throw Error();
   };
   await current();
   const rows=await withGithubAbort(tx.$queryRaw<Array<{
    organizationId:string;userId:string;role:string;acceptedAt:Date|null;sessionId:string;sessionOrganizationId:string;sessionUserId:string;sessionLive:boolean;expiresAt:Date;
    connectionId:string;connectionOrganizationId:string;githubInstallationId:string;connectionRevision:Date;connectionStatus:string;connectionRevokedAt:Date|null;connectionSuspendedAt:Date|null;
   }>>`SELECT m."organizationId",m."userId",m."role",m."acceptedAt",s."id" AS "sessionId",s."organizationId" AS "sessionOrganizationId",s."userId" AS "sessionUserId",s."expiresAt",(s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp()) AS "sessionLive",
    i."id" AS "connectionId",i."organizationId" AS "connectionOrganizationId",i."githubInstallationId",i."updatedAt" AS "connectionRevision",i."status" AS "connectionStatus",i."revokedAt" AS "connectionRevokedAt",i."suspendedAt" AS "connectionSuspendedAt"
    FROM "OrgMembership" m JOIN "DesktopSessionRecord" s ON s."organizationId"=m."organizationId" AND s."userId"=m."userId"
    JOIN "GitHubInstallation" i ON i."organizationId"=m."organizationId" AND i."id"=${bound.connectionId}
    WHERE m."organizationId"=${scope.organizationId} AND m."userId"=${scope.actorUserId} AND s."id"=${scope.sessionId}
    AND i."id"=(SELECT latest."id" FROM "GitHubInstallation" latest WHERE latest."organizationId"=${scope.organizationId} AND latest."status"='active' ORDER BY latest."installedAt" DESC LIMIT 1)
    FOR SHARE OF m,s,i`,signal);
   ready();const row=rows[0];
   if(rows.length!==1||!row||row.organizationId!==scope.organizationId||row.userId!==scope.actorUserId||!['owner','admin','operator','security_reviewer','finance_viewer','read_only'].includes(row.role)||!hasDesktopCapability(row.role as DesktopWorkspaceRole,'github:write')||!(row.acceptedAt instanceof Date)||!Number.isFinite(row.acceptedAt.getTime())||row.sessionId!==scope.sessionId||row.sessionOrganizationId!==scope.organizationId||row.sessionUserId!==scope.actorUserId||row.sessionLive!==true||!(row.expiresAt instanceof Date)||!Number.isFinite(row.expiresAt.getTime())||row.connectionId!==bound.connectionId||row.connectionOrganizationId!==scope.organizationId||row.githubInstallationId!==bound.githubInstallationId||!(row.connectionRevision instanceof Date)||row.connectionRevision.toISOString()!==bound.connectionRevision||row.connectionStatus!=='active'||row.connectionRevokedAt!==null||row.connectionSuspendedAt!==null)throw Error();
   const expiresAt=row.expiresAt.getTime();
   await current();
   // Last awaited DB statement runs after all source-lock waits and pairing IO.
   // Recheck latest installation at this final MVCC snapshot; held row locks keep
   // membership/session/connection updates from changing underneath the lease.
   const clocks=await withGithubAbort(tx.$queryRaw<Array<{now:Date;current:boolean}>>`SELECT clock_timestamp() AS "now",EXISTS (
    SELECT 1 FROM "OrgMembership" m JOIN "DesktopSessionRecord" s ON s."organizationId"=m."organizationId" AND s."userId"=m."userId"
    JOIN "GitHubInstallation" i ON i."organizationId"=m."organizationId"
    WHERE m."organizationId"=${scope.organizationId} AND m."userId"=${scope.actorUserId} AND m."acceptedAt" IS NOT NULL AND m."role" IN ('owner','admin','operator')
    AND s."id"=${scope.sessionId} AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp()
    AND i."id"=${bound.connectionId} AND i."githubInstallationId"=${bound.githubInstallationId} AND i."updatedAt"=${new Date(bound.connectionRevision)} AND i."status"='active' AND i."revokedAt" IS NULL AND i."suspendedAt" IS NULL
    AND i."id"=(SELECT latest."id" FROM "GitHubInstallation" latest WHERE latest."organizationId"=${scope.organizationId} AND latest."status"='active' ORDER BY latest."installedAt" DESC LIMIT 1)
   ) AS "current"`,signal);
   ready();const clock=clocks[0],at=Date.now();
   if(clocks.length!==1||clock.current!==true||!(clock.now instanceof Date)||!Number.isFinite(clock.now.getTime())||clock.now.getTime()>=expiresAt||!Number.isFinite(at)||at<started||at>=expiresAt)throw Error();
   // The store must call this original closure after its final metadata/clock
   // await. It retains private request/session freshness, never a serializable
   // permission marker or a new lifetime derived from caller fields.
   const assertFresh=()=>{try{ready();const at=Date.now();if(!Number.isFinite(at)||at>=expiresAt)throw Error()}catch{throw Error('native_git_lease_authority_unavailable')}};
   assertFresh();return assertFresh;
  }catch{throw Error('native_git_lease_authority_unavailable')}
 };
}
