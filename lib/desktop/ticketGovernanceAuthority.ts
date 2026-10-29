import 'server-only';
import type {NextRequest} from 'next/server';
import type {TicketReviewPorts} from '@/lib/releaseops/ticketGovernanceReviewStore';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {hasDesktopCapability,type DesktopWorkspaceRole} from './desktopAuthorization';
/** Current paired-reader identity and locked membership checks. Reviewing never
 * requires or grants deployment execution; no heartbeat UPDATE occurs under locks. */
export function createTicketGovernanceAuthority(request:NextRequest):NonNullable<TicketReviewPorts['assertCurrent']>{
 return async(tx,input)=>{
  request.signal.throwIfAborted();const s=input.scope,c=input.binding;
  const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'ticket governance review'});
  if(!actor||actor.credentialKind!=='desktop_session'||actor.id!==s.sessionId||actor.userId!==s.actorUserId||actor.organizationId!==s.organizationId||c.organizationId!==s.organizationId)throw Error('ticket_review_session_required');
  const rows=await tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${input.actorUserId} FOR SHARE`;
  const m=rows[0];if(rows.length!==1||m.organizationId!==s.organizationId||m.userId!==input.actorUserId||!m.acceptedAt||!['owner','admin','operator','security_reviewer','finance_viewer','read_only'].includes(m.role)||!hasDesktopCapability(m.role as DesktopWorkspaceRole,'workspace:read'))throw Error('ticket_review_permission_required');
  const capable=(capability:Parameters<typeof hasDesktopCapability>[1])=>hasDesktopCapability(m.role as DesktopWorkspaceRole,capability);
  if(input.role==='approver'&&(!capable('agent:approve')||[c.requesterUserId,c.executorUserId].includes(input.actorUserId))||input.role==='requester'&&(input.actorUserId!==c.requesterUserId||!capable('deploy:execute'))||input.role==='policy_admin'&&(input.actorUserId!==c.requesterUserId||!['owner','admin'].includes(m.role)||!capable('connections:manage')))throw Error('ticket_review_permission_required');
  request.signal.throwIfAborted();
 };
}
