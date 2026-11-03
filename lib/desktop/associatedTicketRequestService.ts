import {createJiraLinkOutboundDrain,createJiraCloseOutboundDrain,assertJiraOutboundIssuerAvailable} from '@/lib/governance/intelligence/jiraOutboundDrain';
import {assertNoUncoveredGovernanceExecution} from '@/lib/governance/intelligence/uncoveredExecution';
import {createServiceNowNativeLinkPreflight} from '@/lib/releaseops/serviceNowNativeLinkPreflight';
import {inspectServiceNowPreflight} from '@/lib/releaseops/serviceNowPreflightInspection';
import type {ServiceNowTicketActionCandidate} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {createServiceNowAssociatedNativePlan} from './serviceNowAssociatedNativePlan';
import {createServiceNowNativeSubmissionAdapter} from './serviceNowNativeSubmissionAdapter';
import {createServiceNowTicketTransport,serviceNowTicketCredentialSchema} from '@/lib/releaseops/serviceNowTicketTransport';
import {createNarrowServiceNowJournalVerifier} from '@/lib/releaseops/serviceNowJournalProofReader';
import {serviceNowGrantedScopesSchema,SERVICE_NOW_PROOF_SCOPE} from '@/lib/integrations/servicenow/serviceNowScopes';
import {ticketReleaseAssociationSchema} from '@/lib/releaseops/ticketGovernanceReviewContract';
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
/** Existing tenant connections and durable independent reviews only. ServiceNow
 * execution additionally requires the exact narrow proof grant and endpoint. */
export function createAssociatedTicketRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:TicketReviewScope,reference:TicketGovernanceReference,options:{inspection?:boolean}={}){
 const governance=createTicketGovernanceRequestService(request,repo,scope,options),authority=createTicketGovernanceAuthority(request);
 const enabled=()=>process.env.AXIOM_TICKET_GOVERNANCE_REVIEWS_ENABLED==='true'&&process.env.AXIOM_JIRA_TICKET_LIFECYCLE_ENABLED==='true'&&process.env.AXIOM_JIRA_TICKET_WRITES_ENABLED==='true';
 async function current(){request.signal.throwIfAborted();const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'associated ticket actions'});if(!actor||actor.credentialKind!=='desktop_session'||actor.organizationId!==scope.organizationId||actor.userId!==scope.actorUserId||actor.id!==scope.sessionId)throw Error('desktop_session_required')}
 async function administrator(){await current();const actor=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:trigger',requiredCapability:'connections:manage',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'associated ticket closure'});if(!actor||actor.id!==scope.sessionId||actor.userId!==scope.actorUserId||actor.organizationId!==scope.organizationId||!['owner','admin'].includes(String(actor.role)))throw Error('ticket_closure_administrator_required')}
 const snEnabled=()=>process.env.AXIOM_TICKET_GOVERNANCE_REVIEWS_ENABLED==='true'&&process.env.AXIOM_SERVICENOW_TICKET_LIFECYCLE_ENABLED==='true'&&process.env.AXIOM_SERVICENOW_TICKET_WRITES_ENABLED==='true';
 const snConnection=createServiceNowTicketConnectionReader(prisma as unknown as ServiceNowTicketConnectionRepository,Date.now,{allowTicketWrites:org=>org===scope.organizationId&&snEnabled()});
 const nativeCatalog=createServiceNowNativeSubmissionAdapter({readConnection:snConnection.readConnection,readCatalogCredential:snConnection.readCatalogCredential});
 const closeNative=createGovernedServiceNowCloseReader({assertCurrent:async(s,signal)=>{if(sha256ContentHash(s)!==sha256ContentHash(scope))throw Error('ticket_review_scope_changed');signal.throwIfAborted();await current()},readApprovedPolicy:async(s,id,signal)=>{const review=await governance.get(s,id,signal);return governance.preflightApproved(s,{reviewId:review.id,bindingDigest:review.bindingDigest},signal)},readCredential:snConnection.readCatalogCredential});
 const nativePlanPorts:Parameters<typeof createServiceNowAssociatedNativePlan>[0]={
  assertCurrent:async(s,c,signal)=>{if(sha256ContentHash(s)!==sha256ContentHash(scope)||c.kind==='publish'||sha256ContentHash(c.association)!==sha256ContentHash(reference))throw Error('ticket_association_changed');signal.throwIfAborted();await current();await governance.preflightApproved(scope,reference,signal)},
  readOriginal:async(s,_c,signal)=>{const proof=await governance.preflightApproved(s,reference,signal);return(await repo.$transaction(tx=>governance.readOriginalForAssociation(tx,s,ticketReleaseAssociationSchema.parse(proof.binding)))).candidate},
  readMetadata:nativeCatalog.readMetadata,
  readCloseMetadata:async(s,c,signal)=>{if(!c.terminalPolicy)throw Error('servicenow_closure_reviews_required');const proof=await governance.preflightApproved(s,c.terminalPolicy,signal);if(proof.reviewId!==c.terminalPolicy.reviewId||proof.bindingDigest!==c.terminalPolicy.bindingDigest)throw Error('servicenow_terminal_policy_changed');return closeNative(s,c.terminalPolicy.reviewId,c.issue,signal)},
 };
 const nativePlan=createServiceNowAssociatedNativePlan(nativePlanPorts);
 const nativeLinkPreflight=createServiceNowNativeLinkPreflight({reference,assertNativePlan:(candidate,signal)=>nativePlan(scope,candidate,signal),assertCurrent:async signal=>{signal.throwIfAborted();await current();signal.throwIfAborted()}});
 return createAssociatedTicketActionsService(repo,reference,{
  inspectServiceNowPreflight:options.inspection?async(s,c,signal)=>{await administrator();const config=await snConnection.readJournalConfiguration(s,c,signal);return inspectServiceNowPreflight(c,{apiNamespace:config.apiNamespace,createReaders:(fetcher,candidate)=>{
   const catalog=createServiceNowNativeSubmissionAdapter({readConnection:snConnection.readConnection,readCatalogCredential:snConnection.readCatalogCredential},{fetch:fetcher});const native=createServiceNowAssociatedNativePlan({...nativePlanPorts,readMetadata:catalog.readMetadata});
   const credential=(parent:AbortSignal)=>snConnection.readCredential(s,candidate,parent),assertAuthority=async(parent:AbortSignal)=>{parent.throwIfAborted();await administrator();await governance.preflightApproved(s,reference,parent)};
   const journal=createNarrowServiceNowJournalVerifier({apiNamespace:config.apiNamespace,fetchImpl:fetcher,readCredential:(_candidate,parent)=>credential(parent),assertCurrent:(_candidate,parent)=>assertAuthority(parent)});
   return{assertAuthority,readCredential:credential,assertJournalAbsent:parent=>journal.assertJournalAbsent(candidate,parent),assertNativePlan:parent=>native(s,candidate,parent)};
  }},signal)}:undefined,
  governance,readServiceNowClosureDiscovery:async(s,policy,issue,signal)=>{const reader=createGovernedServiceNowCloseReader({assertCurrent:async(readerScope,parent)=>{if(sha256ContentHash(readerScope)!==sha256ContentHash(scope))throw Error('ticket_review_scope_changed');parent.throwIfAborted();await current()},readApprovedPolicy:async(readerScope,id,parent)=>{if(id!==policy.reviewId)throw Error('servicenow_policy_changed');return governance.preflightApproved(readerScope,policy,parent)},readCredential:snConnection.readCatalogCredential});return reader(s,policy.reviewId,issue,signal)},readJiraClosureDiscovery:async(s,c,issue,signal)=>{await administrator();if(s.actorUserId!==scope.actorUserId)throw Error('ticket_executor_required');const credential=await readJiraTicketCredential(c,s.actorUserId,current,signal);return readJiraTerminalTransitions({candidate:c,issue,credential,assertCurrent:current,signal})},readOriginal:(tx,s,a)=>governance.readOriginalForAssociation(tx,s,a),
  authorize:async(tx,s,userId,role,binding,candidate)=>{if(sha256ContentHash(s)!==sha256ContentHash(scope))throw Error('ticket_review_scope_changed');await authority(tx,{scope:s,actorUserId:userId,role:role==='read'?'reader':role==='approve'?'approver':'requester',binding});if((candidate?.kind==='close'||candidate?.kind==='link'&&'instanceOrigin'in candidate&&candidate.freshAttempt)&&(role==='prepare'||role==='execute')){const rows=await tx.$queryRaw<Array<{role:string}>>`SELECT "role" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${userId} FOR SHARE`;if(rows.length!==1||!['owner','admin'].includes(rows[0].role)||!hasDesktopCapability(rows[0].role as DesktopWorkspaceRole,'connections:manage'))throw Error('ticket_closure_administrator_required')}},
  writeReady:async(tx,s,c,a)=>{
   if(!['link','close'].includes(c.kind)||s.organizationId!==scope.organizationId||!('siteId'in c?enabled():snEnabled()))return false;
   const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;provider:string;status:string;revokedAt:Date|null;updatedAt:Date;externalAccountId:string|null;consentedByUserId:string|null;scopesJson:unknown}>>`SELECT "id","organizationId","provider","status","revokedAt","updatedAt","externalAccountId","consentedByUserId","scopesJson" FROM "TenantIntegrationConnection" WHERE "id"=${c.connectionId} AND "organizationId"=${s.organizationId} FOR SHARE`;
   const row=rows[0];await current();if(!('siteId'in c)){const grants=serviceNowGrantedScopesSchema.safeParse(row?.scopesJson);return rows.length===1&&row.id===c.connectionId&&row.organizationId===s.organizationId&&row.provider==='servicenow'&&row.status==='active'&&!row.revokedAt&&row.updatedAt.toISOString()===c.connectionRevision&&row.externalAccountId===c.instanceOrigin&&row.consentedByUserId===a.executorUserId&&grants.success&&grants.data.includes(SERVICE_NOW_PROOF_SCOPE)&&snEnabled()}const scopes=jiraRecordedScopesSchema.safeParse(row?.scopesJson);return rows.length===1&&row.id===c.connectionId&&row.organizationId===s.organizationId&&row.provider==='jira'&&row.status==='active'&&!row.revokedAt&&row.updatedAt.toISOString()===c.connectionRevision&&row.externalAccountId===c.siteId&&row.consentedByUserId===a.executorUserId&&scopes.success&&new Set(scopes.data).size===scopes.data.length&&scopes.data.includes('read:jira-work')&&scopes.data.includes('write:jira-work')&&enabled();
  },
  probeServiceNowJournal:async(s,c,signal)=>{
   if(sha256ContentHash(s)!==sha256ContentHash(scope))throw Error('ticket_review_scope_changed');await administrator();
   const config=await snConnection.readJournalConfiguration(s,c,signal),journal=createNarrowServiceNowJournalVerifier({apiNamespace:config.apiNamespace,readCredential:(candidate,parent)=>snConnection.readCredential(s,candidate,parent),assertCurrent:async(candidate,parent)=>{parent.throwIfAborted();if(sha256ContentHash(candidate)!==sha256ContentHash(c))throw Error('ticket_action_changed');await current()}});
   const absent=await journal.assertJournalAbsent(c,signal);signal.throwIfAborted();await administrator();return{absent};
  },
  preflightTransport:async(s,c,a,signal)=>{
   await assertNoUncoveredGovernanceExecution(request,repo,s,signal);
   if(!('siteId'in c)){
    if(c.kind==='publish'||!snEnabled()||s.actorUserId!==a.executorUserId)throw Error('ticket_provider_execution_unavailable');if(c.kind==='close'||c.kind==='link'&&c.freshAttempt)await administrator();
    const auth=serviceNowTicketCredentialSchema.parse(await snConnection.readCredential(s,c,signal));if(!auth.permissions.write||!auth.permissions.journalRead||auth.expiresAt<=Date.now()+15000)throw Error('servicenow_scoped_credential_unavailable');await snConnection.readJournalConfiguration(s,c,signal);if(c.kind==='link'&&c.association)await nativeLinkPreflight.validateBeforeClaim(c,signal);else{await nativePlan(s,c,signal);await current()}return;
   }if(!['link','close'].includes(c.kind))throw Error('ticket_provider_execution_unavailable');
   assertJiraOutboundIssuerAvailable();
   if(!enabled()||s.actorUserId!==a.executorUserId)throw Error('ticket_provider_execution_unavailable');
   if(c.kind==='close')await administrator();const auth=jiraTicketCredentialSchema.parse(await readJiraTicketCredential(c,a.executorUserId,current,signal));if(!auth.scopes.includes('write:jira-work')||auth.expiresAt<=Math.min(Date.now()+15000,Date.parse(c.expiresAt)))throw Error('ticket_provider_credential_unavailable');await current();
  },
  executeTransport:async(id,c,signal,assertClaim,jiraOutbound)=>{
   const guardedAssertClaim:typeof assertClaim=async(...args)=>{await assertClaim(...args);await assertNoUncoveredGovernanceExecution(request,repo,scope,args[1])};
   if(!('siteId'in c)){
    if(c.kind==='publish'||!snEnabled())throw Error('ticket_provider_execution_unavailable');
    const config=await snConnection.readJournalConfiguration(scope,c,signal),credential=(candidate:Readonly<ServiceNowTicketActionCandidate>,s:AbortSignal)=>snConnection.readCredential(scope,candidate,s);
    const journal=createNarrowServiceNowJournalVerifier({apiNamespace:config.apiNamespace,readCredential:credential,assertCurrent:async(candidate,s)=>{await current();await guardedAssertClaim(candidate,s)}});
    const transport=createServiceNowTicketTransport({consumeNativeLinkPreflight:candidate=>nativeLinkPreflight.consume(candidate),onRefusal:detail=>console.warn("axiom_servicenow_transport_refused",detail),isEnabled:snEnabled,assertCurrent:async(actionId,candidate,s,context)=>{if(actionId!==id)throw Error('ticket_action_changed');await current();await guardedAssertClaim(candidate,s,context)},readCredential:credential,assertNativePlan:(candidate,s)=>nativePlan(scope,candidate,s),...journal});
    return{status:(await transport.execute(id,c,signal)).status};
   }if(!['link','close'].includes(c.kind))throw Error('ticket_provider_execution_unavailable');
   if(!jiraOutbound||c.kind==='publish')throw Error('jira_outbound_unavailable');
   const outbound=(c.kind==='link'?createJiraLinkOutboundDrain:createJiraCloseOutboundDrain)(repo,request,scope,id,jiraOutbound,{signal,isEnabled:enabled});
   const transport=createJiraTicketTransport({isEnabled:enabled,beforeSubmission:outbound.beforeSubmission,assertCurrent:async(actionId,candidate,s)=>{if(actionId!==id)throw Error('ticket_action_changed');s.throwIfAborted();const proof=await repo.$transaction(tx=>(c.kind==='link'?jiraOutbound.readClaimedJiraLinkOutboundLocked:jiraOutbound.readClaimedJiraCloseOutboundLocked)(tx,scope,id,candidate));s.throwIfAborted();proof.fresh();return proof.fresh},readCredential:async(candidate,s)=>{await outbound.beforeCredential(candidate,s);return readJiraTicketCredential(candidate,scope.actorUserId,current,s)}});
   const result=await transport.execute(id,c,signal);return{status:result.status};
  },
 });
}
