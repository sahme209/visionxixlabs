import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {prisma} from '@/lib/db';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {createTicketGovernanceAuthority} from './ticketGovernanceAuthority';
import {createTicketHistoricalReadAuthority} from './ticketHistoricalReadAuthority';
import {createTicketHistoricalStores} from './ticketHistoricalStores';
import {createTicketGovernanceService} from './ticketGovernanceService';
import {createTicketAssociationProviderReader} from './ticketAssociationProviderRead';
import {readJiraTicketCredential} from './jiraTicketCredential';
import {bindPublishedTicketReadCandidate} from './ticketAssociationReadBinding';
import {createServiceNowTicketConnectionReader,type ServiceNowTicketConnectionRepository} from './serviceNowTicketConnection';
import {createServiceNowModelPreflight} from './serviceNowModelPreflight';
import {createTicketAssociationProposal,ticketAssociationRequestSchema} from './ticketAssociationProposal';
import type {TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
/** Production-capable LOCAL composition; activation and provider write transports
 * remain separate. Every network adapter here supports fixed GET reads only. */
export function createTicketGovernanceRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:TicketReviewScope){
 const authority=createTicketGovernanceAuthority(request),historicalAuthority=createTicketHistoricalReadAuthority(request);
 async function current(s:TicketReviewScope,signal:AbortSignal){
  signal.throwIfAborted();if(sha256ContentHash(s)!==sha256ContentHash(scope))throw Error('ticket_review_scope_changed');
  const p=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'ticket governance preflight'});
  if(!p||p.credentialKind!=='desktop_session'||p.id!==scope.sessionId||p.userId!==scope.actorUserId||p.organizationId!==scope.organizationId)throw Error('ticket_review_session_required');signal.throwIfAborted();
 }
 const stores=createTicketHistoricalStores(repo,{assertDeploymentReader:historicalAuthority,assertTicketReader:async(_tx,s,c)=>{if(c.organizationId!==s.organizationId)throw Error('ticket_archive_scope_changed');await current(s,request.signal)}});
 const sn=createServiceNowTicketConnectionReader(prisma as unknown as ServiceNowTicketConnectionRepository);
 const readTicket=createTicketAssociationProviderReader({fetch,assertCurrent:async(s,t,signal)=>{
  await current(s,signal);
  const row=await prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:s.organizationId,provider:t.provider}}});
  if(!row||row.id!==t.connectionId||row.organizationId!==s.organizationId||row.status!=='active'||row.revokedAt||row.updatedAt.toISOString()!==t.connectionRevision||row.externalAccountId!==(t.provider==='jira'?t.siteId:t.instanceOrigin))throw Error('ticket_review_connection_changed');
  await current(s,signal);
 },readJiraCredential:async(s,c,signal)=>{
  const hint=originalHint(c),original=await repo.$transaction(tx=>stores.readOriginal(tx,s,hint.actionId,'jira')) as {candidate:unknown;issue:unknown;executorUserId:string};const data=bindPublishedTicketReadCandidate(s.organizationId,hint.ticket,original);if(sha256ContentHash(data.candidate)!==sha256ContentHash(c))throw Error('ticket_original_changed');
  return readJiraTicketCredential(c,data.executorUserId,()=>current(s,signal),signal);
 },readServiceNowCredential:(s,c,signal)=>sn.readCatalogCredential(s,c,signal)});
 // The original action ID is attached only within this request after audited
 // provenance read; candidates from the client cannot supply a substitute ID.
 const originals=new Map<string,{actionId:string;ticket:import('@/lib/releaseops/ticketGovernanceReviewContract').TicketReleaseAssociation['ticket']}>();
 function originalHint(candidate:unknown){const hint=originals.get(sha256ContentHash(candidate));if(!hint)throw Error('ticket_original_preflight_required');return hint}
 const model=createServiceNowModelPreflight({readConnection:sn.readConnection,readCredential:sn.readCatalogCredential});
 const service=createTicketGovernanceService(repo,{
  assertCurrent:authority,associationSource:stores,readTicket,readModel:model,
  assertPreflightAuthority:async(s,b,signal)=>{await current(s,signal);await repo.$transaction(tx=>authority(tx,{scope:s,actorUserId:s.actorUserId,role:'reader',binding:b}));await current(s,signal)},
  readOriginalCandidate:async(s,b,signal)=>{await current(s,signal);const original=await repo.$transaction(tx=>stores.readOriginal(tx,s,b.original.actionId,b.ticket.provider))as {candidate:unknown;actionId:string;issue:unknown;executorUserId:string};if(original.actionId!==b.original.actionId)throw Error('ticket_original_changed');const readBinding=bindPublishedTicketReadCandidate(s.organizationId,b.ticket,original);originals.set(sha256ContentHash(readBinding.candidate),{actionId:original.actionId,ticket:b.ticket});await current(s,signal);return readBinding.candidate},
 });
 return{...service,prepare:async(s:TicketReviewScope,raw:unknown,nonce:string,signal:AbortSignal)=>{
  if(raw&&typeof raw==='object'&&'kind'in raw&&raw.kind==='ticket_release_association_request'){
   const selected=ticketAssociationRequestSchema.parse(raw);
   const propose=createTicketAssociationProposal({assertCurrent:current,
    readOriginal:(reader,id,provider)=>repo.$transaction(tx=>stores.readOriginal(tx,reader,id,provider)),
    readEvidence:(reader,id)=>repo.$transaction(tx=>stores.readEvidence(tx,reader,id)),
    readHead:async(reader,id,sig)=>{await current(reader,sig);const row=await prisma.tauriDeploymentRequest.findUnique({where:{id}});if(!row||row.organizationId!==reader.organizationId)throw Error('ticket_deployment_unavailable');return row},
    readConnection:async(reader,provider,sig)=>{await current(reader,sig);return prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:reader.organizationId,provider}}})},
    readTicket:async(reader,target,candidate,sig)=>{originals.set(sha256ContentHash(candidate),{actionId:selected.originalActionId,ticket:target});return readTicket(reader,target,candidate,sig)},
   });
   return service.prepare(s,await propose(s,selected,signal),nonce,signal);
  }
  if(raw&&typeof raw==='object'&&'kind'in raw&&raw.kind==='ticket_release_association')throw Error('ticket_server_association_proposal_required');
  return service.prepare(s,raw,nonce,signal);
 }};
}
