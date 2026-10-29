import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketReleaseAssociationSchema,ticketReviewScopeSchema,type TicketReviewScope,type TicketReleaseAssociation} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {parseJiraTicketActionCandidate} from '@/lib/releaseops/jiraTicketLifecycleContract';
import {parseServiceNowTicketActionCandidate} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {parseReleaseWorkflowEvidenceDto} from '@/lib/tauri/releaseWorkflowEvidenceContract';
import {bindPublishedTicketReadCandidate} from './ticketAssociationReadBinding';
export const ticketAssociationRequestSchema=z.object({kind:z.literal('ticket_release_association_request'),provider:z.enum(['jira','servicenow']),originalActionId:z.string().regex(/^(jira|servicenow)_action_[a-f0-9]{64}$/),evidenceId:z.string().regex(/^release_workflow_evidence_[a-f0-9]{64}$/),expectedHeadVersion:z.number().int().positive()}).strict();
interface ProposalPorts{
 assertCurrent:(scope:TicketReviewScope,signal:AbortSignal)=>Promise<void>;
 readOriginal:(scope:TicketReviewScope,id:string,provider:'jira'|'servicenow',signal:AbortSignal)=>Promise<unknown>;
 readEvidence:(scope:TicketReviewScope,id:string,signal:AbortSignal)=>Promise<unknown>;
 readHead:(scope:TicketReviewScope,releaseId:string,signal:AbortSignal)=>Promise<unknown>;
 readConnection:(scope:TicketReviewScope,provider:'jira'|'servicenow',signal:AbortSignal)=>Promise<unknown>;
 readTicket:(scope:TicketReviewScope,target:TicketReleaseAssociation['ticket'],candidate:unknown,signal:AbortSignal)=>Promise<unknown>;
 now?:()=>number;
}
/** The browser supplies selection IDs only. Original provenance, deployment
 * binding/digests, current head and exact ticket read are rebuilt server-side. */
export function createTicketAssociationProposal(ports:ProposalPorts){
 return async(rawScope:TicketReviewScope,rawInput:unknown,parent:AbortSignal)=>{
  const scope=ticketReviewScopeSchema.parse(rawScope),input=ticketAssociationRequestSchema.parse(rawInput),signal=AbortSignal.any([parent,AbortSignal.timeout(20000)]),now=ports.now??Date.now;
  const current=async()=>{signal.throwIfAborted();await withGithubAbort(ports.assertCurrent(scope,signal),signal);signal.throwIfAborted()};await current();
  if(!input.originalActionId.startsWith(input.provider==='jira'?'jira_action_':'servicenow_action_'))throw Error('ticket_original_changed');
  const original=z.object({actionId:z.string(),actionVersion:z.number().int().min(0),requesterUserId:z.string(),executorUserId:z.string(),candidate:z.unknown(),issue:z.unknown(),recovery:z.unknown().nullable()}).strict().parse(await withGithubAbort(ports.readOriginal(scope,input.originalActionId,input.provider,signal),signal));
  const c=input.provider==='jira'?parseJiraTicketActionCandidate(original.candidate):parseServiceNowTicketActionCandidate(original.candidate);
  if(original.actionId!==input.originalActionId||c.kind!=='publish'||c.organizationId!==scope.organizationId||original.executorUserId!==scope.actorUserId)throw Error('ticket_original_changed');
  const connection=z.object({id:z.string(),organizationId:z.string(),provider:z.string(),status:z.literal('active'),revokedAt:z.null(),updatedAt:z.date(),externalAccountId:z.string(),consentedByUserId:z.string()}).passthrough().parse(await withGithubAbort(ports.readConnection(scope,input.provider,signal),signal));
  if(connection.id!==c.connectionId||connection.organizationId!==scope.organizationId||connection.provider!==input.provider||connection.consentedByUserId!==original.executorUserId)throw Error('ticket_connection_changed');
  const target=(input.provider==='jira'?{provider:'jira',connectionId:connection.id,connectionRevision:connection.updatedAt.toISOString(),siteId:connection.externalAccountId,issue:original.issue}:{provider:'servicenow',connectionId:connection.id,connectionRevision:connection.updatedAt.toISOString(),instanceOrigin:connection.externalAccountId,issue:original.issue})as TicketReleaseAssociation['ticket'];
  const readBinding=bindPublishedTicketReadCandidate(scope.organizationId,target,original);
  const evidence=parseReleaseWorkflowEvidenceDto(await withGithubAbort(ports.readEvidence(scope,input.evidenceId,signal),signal)),b=evidence.binding;
  if(evidence.id!==input.evidenceId||b.organizationId!==scope.organizationId||evidence.state!=='observed'||evidence.observation?.status!=='completed'||evidence.observation.conclusion!=='success'||evidence.observation.bindingDigest!==sha256ContentHash(b))throw Error('ticket_successful_deployment_required');
  const head=z.object({id:z.string(),organizationId:z.string(),version:z.number().int().positive(),intakeJson:z.unknown()}).passthrough().parse(await withGithubAbort(ports.readHead(scope,b.releaseId,signal),signal));
  if(head.id!==b.releaseId||head.organizationId!==scope.organizationId||head.version!==input.expectedHeadVersion||head.version<b.releaseVersion)throw Error('ticket_deployment_head_changed');
  const receipt=z.object({digest:z.string().regex(/^[a-f0-9]{64}$/),observedAt:z.string().datetime()}).passthrough().parse(await withGithubAbort(ports.readTicket(scope,target,readBinding.candidate,signal),signal));
  await current();const at=now(),observed=Date.parse(receipt.observedAt);if(!Number.isFinite(at)||observed>at||at-observed>30000)throw Error('ticket_read_expired');
  return ticketReleaseAssociationSchema.parse({kind:'ticket_release_association',organizationId:scope.organizationId,requesterUserId:scope.actorUserId,executorUserId:scope.actorUserId,expiresAt:new Date(at+900000).toISOString(),original:{releaseId:c.releaseId,releaseVersion:c.releaseVersion,intakeDigest:c.sourceDigest,actionId:original.actionId,actionVersion:original.actionVersion,payloadDigest:c.payloadDigest,recoveryDigest:original.recovery?sha256ContentHash(original.recovery):null},ticket:target,ticketReadDigest:receipt.digest,deployment:{headReleaseVersion:head.version,headIntakeDigest:sha256ContentHash({requestVersion:head.version,intake:head.intakeJson}),binding:b,evidenceId:evidence.id,evidenceDigest:sha256ContentHash(evidence),acceptedOperationId:'release_deployment_'+sha256ContentHash({organizationId:scope.organizationId,releaseId:b.releaseId,releaseVersion:b.releaseVersion,planId:b.planId})}});
 };
}
