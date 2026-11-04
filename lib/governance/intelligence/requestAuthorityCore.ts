import 'server-only';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import type {DesktopRequestPrincipal,ResolveOptions} from '@/lib/desktop/desktopSessionResolverCore';
export type CapturedSessionResolver=(request:NextRequest,options:ResolveOptions)=>Promise<DesktopRequestPrincipal|null|undefined>;
import {hasDesktopCapability,type DesktopCapability,type DesktopWorkspaceRole} from '@/lib/desktop/desktopAuthorization';
import type {ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {identifier} from './contracts';
import type {RevisionScope} from './revisionStore';
const scopeSchema=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
const roles=['owner','admin','operator','security_reviewer','finance_viewer','read_only'];
export type GovernanceAuthorityRole='reader'|'github_reader'|'aws_reader'|'collector'|'policy_admin'|'approver';
const capabilities:Record<GovernanceAuthorityRole,DesktopCapability>={reader:'workspace:read',github_reader:'github:read',aws_reader:'workspace:read',collector:'policy:manage',policy_admin:'policy:manage',approver:'agent:approve'};
/** Existing paired authority only. No new role or stored token permission is
 * inferred. Locked DB reads supplement the request's current commercial access. */
export function createPrivateGovernanceRequestAuthority(request:NextRequest,resolveRequestDesktopSession:CapturedSessionResolver){return async(tx:Tx,raw:RevisionScope,role:GovernanceAuthorityRole)=>{
 const scope=scopeSchema.parse(raw),capability=capabilities[role];if(!capability)throw Error('governance_authority_required');
 async function current(){request.signal.throwIfAborted();const p=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:capability,requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'governance intelligence'});if(!p||p.credentialKind!=='desktop_session'||p.id!==scope.sessionId||p.userId!==scope.actorUserId||p.organizationId!==scope.organizationId)throw Error('governance_authority_required');request.signal.throwIfAborted()}
 await current();
 const members=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${scope.organizationId} AND "userId"=${scope.actorUserId} FOR SHARE`,m=members[0];
 if(members.length!==1||m.organizationId!==scope.organizationId||m.userId!==scope.actorUserId||!m.acceptedAt||!roles.includes(m.role)||!hasDesktopCapability(m.role as DesktopWorkspaceRole,capability))throw Error('governance_authority_required');
 const sessions=await tx.$queryRaw<Array<{id:string;organizationId:string;userId:string;live:boolean}>>`SELECT "id","organizationId","userId",("revokedAt" IS NULL AND "expiresAt" > clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${scope.sessionId} AND "organizationId"=${scope.organizationId} AND "userId"=${scope.actorUserId} FOR SHARE`,s=sessions[0];
 if(sessions.length!==1||s.id!==scope.sessionId||s.organizationId!==scope.organizationId||s.userId!==scope.actorUserId||s.live!==true)throw Error('governance_authority_required');await current();
}}
