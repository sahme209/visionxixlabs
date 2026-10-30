import {createGovernedServiceNowCloseReader} from './serviceNowGovernedCloseReader';
import {createServiceNowTicketConnectionReader,type ServiceNowTicketConnectionRepository} from './serviceNowTicketConnection';
import {hasDesktopCapability,type DesktopWorkspaceRole} from './desktopAuthorization';
import {readJiraTerminalTransitions} from '@/lib/releaseops/jiraTicketCloseDiscovery';
import 'server-only';
import type {NextRequest} from 'next/server';
import {prisma} from '@/lib/db';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {jiraRecordedScopesSchema} from '@/lib/integrations/jira/jiraRecordedScopes';
import type {TicketGovernanceReference} from '@/lib/releaseops/ticketGovernanceReference';
import type {TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {createJiraTicketTransport,jiraTicketCredentialSchema} from '@/lib/releaseops/jiraTicketTransport';
import {createAssociatedTicketActionsService} from './associatedTicketActionsService';
import {createTicketGovernanceRequestService} from './ticketGovernanceRequestService';
import {createTicketGovernanceAuthority} from './ticketGovernanceAuthority';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {readJiraTicketCredential} from './jiraTicketCredential';
/** Existing tenant connections/approval stores only. ServiceNow journal writes
 * remain unavailable until a separately reviewed readback adapter is installed. */
export function createAssociatedTicketRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:TicketReviewScope,reference:TicketGovernanceReference){
 const governance=createTicketGovernanceRequestService(request,repo,scope),authority=createTicketGovernanceAuthority(request);
 const enabled=()=>process.env.AXIOM_TICKET_GOVERNANCE_REVIEWS_ENABLED==='true'&&process.env.AXIOM_JIRA_TICKET_LIFECYCLE_ENABLED==='true'&&process.env.AXIOM_JIRA_TICKET_WRITES_ENABLED==='true';
 async function current(){request.signal.throwIfAborted();const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'associated ticket actions'});if(!actor||actor.credentialKind!=='desktop_session'||actor.organizationId!==scope.organizationId||actor.userId!==scope.actorUserId||actor.id!==scope.sessionId)throw Error('desktop_session_required')}
 async function administrator(){await current();const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:trigger',requiredCapability:'connections:manage',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'associated ticket closure'});if(!actor||actor.id!==scope.sessionId||actor.userId!==scope.actorUserId||actor.organizationId!==scope.organizationId||!['owner','admin'].includes(String(actor.role)))throw Error('ticket_closure_administrator_required')}
 const snConnection=createServiceNowTicketConnectionReader(prisma as unknown as ServiceNowTicketConnectionRepository);
 return createAssociatedTicketActionsService(repo,reference,{
  governance,readServiceNowClosureDiscovery:async(s,policy,issue,signal)=>{const reader=createGovernedServiceNowCloseReader({assertCurrent:async(readerScope,parent)=>{if(sha256ContentHash(readerScope)!==sha256ContentHash(scope))throw Error('ticket_review_scope_changed');parent.throwIfAborted();await current()},readApprovedPolicy:async(readerScope,id,parent)=>{if(id!==policy.reviewId)throw Error('servicenow_policy_changed');return governance.preflightApproved(readerScope,policy,parent)},readCredential:snConnection.readCatalogCredential});return reader(s,policy.reviewId,issue,signal)},readJiraClosureDiscovery:async(s,c,issue,signal)=>{await administrator();if(s.actorUserId!==scope.actorUserId)throw Error('ticket_executor_required');const credential=await readJiraTicketCredential(c,s.actorUserId,current,signal);return readJiraTerminalTransitions({candidate:c,issue,credential,assertCurrent:current,signal})},readOriginal:(tx,s,a)=>governance.readOriginalForAssociation(tx,s,a),
  authorize:async(tx,s,userId,role,binding,candidate)=>{if(sha256ContentHash(s)!==sha256ContentHash(scope))throw Error('ticket_review_scope_changed');await authority(tx,{scope:s,actorUserId:userId,role:role==='read'?'reader':role==='approve'?'approver':'requester',binding});if(candidate?.kind==='close'&&(role==='prepare'||role==='execute')){const rows=await tx.$queryRaw<Array<{role:string}>>`SELECT "role" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${userId} FOR SHARE`;if(rows.length!==1||!['owner','admin'].includes(rows[0].role)||!hasDesktopCapability(rows[0].role as DesktopWorkspaceRole,'connections:manage'))throw Error('ticket_closure_administrator_required')}},
  writeReady:async(tx,s,c,a)=>{
   if(!('siteId'in c)||!['link','close'].includes(c.kind)||!enabled()||s.organizationId!==scope.organizationId)return false;
   const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;provider:string;status:string;revokedAt:Date|null;updatedAt:Date;externalAccountId:string|null;consentedByUserId:string|null;scopesJson:unknown}>>`SELECT "id","organizationId","provider","status","revokedAt","updatedAt","externalAccountId","consentedByUserId","scopesJson" FROM "TenantIntegrationConnection" WHERE "id"=${c.connectionId} AND "organizationId"=${s.organizationId} FOR SHARE`;
   const row=rows[0],scopes=jiraRecordedScopesSchema.safeParse(row?.scopesJson);await current();return rows.length===1&&row.id===c.connectionId&&row.organizationId===s.organizationId&&row.provider==='jira'&&row.status==='active'&&!row.revokedAt&&row.updatedAt.toISOString()===c.connectionRevision&&row.externalAccountId===c.siteId&&row.consentedByUserId===a.executorUserId&&scopes.success&&new Set(scopes.data).size===scopes.data.length&&scopes.data.includes('read:jira-work')&&scopes.data.includes('write:jira-work')&&enabled();
  },
  preflightTransport:async(s,c,a,signal)=>{
   if(!('siteId'in c)||!['link','close'].includes(c.kind))throw Error('servicenow_journal_readback_unavailable');
   if(!enabled()||s.actorUserId!==a.executorUserId)throw Error('ticket_provider_execution_unavailable');
   if(c.kind==='close')await administrator();const auth=jiraTicketCredentialSchema.parse(await readJiraTicketCredential(c,a.executorUserId,current,signal));if(!auth.scopes.includes('write:jira-work')||auth.expiresAt<=Math.min(Date.now()+15000,Date.parse(c.expiresAt)))throw Error('ticket_provider_credential_unavailable');await current();
  },
  executeTransport:async(id,c,signal,assertClaim)=>{
   if(!('siteId'in c)||!['link','close'].includes(c.kind))throw Error('servicenow_journal_readback_unavailable');
   const transport=createJiraTicketTransport({isEnabled:enabled,assertCurrent:(actionId,candidate,s)=>{if(actionId!==id)throw Error('ticket_action_changed');return assertClaim(candidate,s)},readCredential:(candidate,s)=>readJiraTicketCredential(candidate,scope.actorUserId,current,s)});
   const result=await transport.execute(id,c,signal);return{status:result.status};
  },
 });
}
