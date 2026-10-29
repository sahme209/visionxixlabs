import 'server-only';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {hasDesktopCapability,type DesktopWorkspaceRole} from './desktopAuthorization';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {ticketReviewScopeSchema,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
const sourceSchema=z.object({organizationId:z.string().min(1),releaseId:z.string().min(1),releaseVersion:z.number().int().positive(),connectionId:z.string().min(1),connectionRevision:z.string().datetime(),installationId:z.string().regex(/^[1-9][0-9]*$/).optional()}).passthrough();
/** Historical provenance is read under TODAY's paired reader, never by adopting
 * the stored executor/session. This port grants no execution or token lease. */
export function createTicketHistoricalReadAuthority(request:NextRequest){
 return async(tx:ReleaseOperationPlanTransaction,rawScope:TicketReviewScope,rawSource:unknown)=>{
  const scope=ticketReviewScopeSchema.parse(rawScope),source=sourceSchema.parse(rawSource);
  const current=async()=>{request.signal.throwIfAborted();const p=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'github:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'ticket historical deployment evidence'});if(!p||p.credentialKind!=='desktop_session'||p.id!==scope.sessionId||p.userId!==scope.actorUserId||p.organizationId!==scope.organizationId||source.organizationId!==scope.organizationId)throw Error('ticket_historical_reader_required');request.signal.throwIfAborted()};
  await current();
  const members=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${scope.organizationId} AND "userId"=${scope.actorUserId} FOR SHARE`;
  const m=members[0];if(members.length!==1||m.organizationId!==scope.organizationId||m.userId!==scope.actorUserId||!m.acceptedAt||!['owner','admin','operator','security_reviewer','finance_viewer','read_only'].includes(m.role)||!hasDesktopCapability(m.role as DesktopWorkspaceRole,'github:read'))throw Error('ticket_historical_reader_required');
  const sessions=await tx.$queryRaw<Array<{id:string;organizationId:string;userId:string;live:boolean}>>`SELECT "id","organizationId","userId",("revokedAt" IS NULL AND "expiresAt" > clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${scope.sessionId} AND "organizationId"=${scope.organizationId} AND "userId"=${scope.actorUserId} FOR SHARE`;
  const s=sessions[0];if(sessions.length!==1||s.id!==scope.sessionId||s.organizationId!==scope.organizationId||s.userId!==scope.actorUserId||s.live!==true)throw Error('ticket_historical_reader_required');
  const releases=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number}>>`SELECT "id","organizationId","version" FROM "TauriDeploymentRequest" WHERE "id"=${source.releaseId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  const r=releases[0];if(releases.length!==1||r.id!==source.releaseId||r.organizationId!==scope.organizationId||r.version<source.releaseVersion)throw Error('ticket_historical_release_changed');
  const connections=await tx.$queryRaw<Array<{id:string;organizationId:string;status:string;githubInstallationId:string;updatedAt:Date;revokedAt:Date|null;suspendedAt:Date|null}>>`SELECT "id","organizationId","status","githubInstallationId","updatedAt","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "id"=${source.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  const c=connections[0];if(connections.length!==1||c.id!==source.connectionId||c.organizationId!==scope.organizationId||c.status!=='active'||c.revokedAt||c.suspendedAt||c.updatedAt.toISOString()!==source.connectionRevision||! /^[1-9][0-9]*$/.test(c.githubInstallationId)||source.installationId!==undefined&&source.installationId!==c.githubInstallationId)throw Error('ticket_historical_connection_changed');
  await current();
 };
}
