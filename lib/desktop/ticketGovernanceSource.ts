import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketReleaseAssociationSchema,type TicketReleaseAssociation,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {parseReleaseWorkflowEvidenceDto} from '@/lib/tauri/releaseWorkflowEvidenceContract';
import {deploymentPlanSchema,deploymentReceiptSchema} from '@/lib/tauri/releaseDeploymentExecutionContract';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {parseJiraTicketActionCandidate} from '@/lib/releaseops/jiraTicketLifecycleContract';
import {parseServiceNowTicketActionCandidate,serviceNowTicketRecoverySchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
export interface TicketAssociationSourcePorts {
 /** Existing lifecycle store readPublishedProvenance: audited original result/recovery, no writes. */
 readOriginal?:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,actionId:string,provider:'jira'|'servicenow')=>Promise<unknown>;
 /** Existing readHistoricalAcceptedSource, current reader authority, never stored-session authentication. */
 readAccepted?:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,operationId:string)=>Promise<unknown>;
 readReviewedBinding?:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,binding:TicketReleaseAssociation['deployment']['binding'])=>Promise<unknown>;
 readEvidence?:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,evidenceId:string)=>Promise<unknown>;
 /** Fixed provider exact-ticket read, performed before transaction locks. Revalidated receipt only. */
 readTicketReceipt?:(scope:TicketReviewScope,ticket:TicketReleaseAssociation['ticket'])=>Promise<{digest:string;observedAt:string}>;
 now?:()=>number;
}
const acceptedSchema=z.object({operationId:z.string(),plan:deploymentPlanSchema,deploymentPlanDigest:z.string(),receipt:deploymentReceiptSchema,acceptedAt:z.string().datetime(),expiresAt:z.string().datetime(),dispatchEvidenceDigest:z.string()}).strict();
/** All metadata is rebuilt under the caller's current scope. Receipts are installed only by
 * server composition, not a request body. Caller proposals never establish provenance. */
export function createTicketAssociationLockedSource(ports:TicketAssociationSourcePorts={}){
 return async(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,raw:TicketReleaseAssociation)=>{
  if(!ports.readOriginal||!ports.readAccepted||!ports.readEvidence||!ports.readReviewedBinding||!ports.readTicketReceipt)throw Error('ticket_association_source_unavailable');
  const a=ticketReleaseAssociationSchema.parse(raw),now=ports.now??Date.now;
  if(a.organizationId!==scope.organizationId)throw Error('ticket_association_source_changed');
  const original=z.object({actionId:z.string(),actionVersion:z.number().int(),requesterUserId:z.string(),executorUserId:z.string(),candidate:z.unknown(),issue:z.unknown(),recovery:serviceNowTicketRecoverySchema.nullable()}).strict().parse(await ports.readOriginal(tx,scope,a.original.actionId,a.ticket.provider));
  const c=a.ticket.provider==='jira'?parseJiraTicketActionCandidate(original.candidate):parseServiceNowTicketActionCandidate(original.candidate);
  if(c.kind!=='publish'||original.actionId!==a.original.actionId||original.actionVersion!==a.original.actionVersion||c.organizationId!==scope.organizationId||c.releaseId!==a.original.releaseId||c.releaseVersion!==a.original.releaseVersion||c.sourceDigest!==a.original.intakeDigest||c.payloadDigest!==a.original.payloadDigest||original.executorUserId!==a.executorUserId||c.connectionId!==a.ticket.connectionId||sha256ContentHash(original.issue)!==sha256ContentHash(a.ticket.issue)||('siteId'in c? a.ticket.provider!=='jira'||c.siteId!==a.ticket.siteId:a.ticket.provider!=='servicenow'||c.instanceOrigin!==a.ticket.instanceOrigin)|| (original.recovery?sha256ContentHash(original.recovery):null)!==a.original.recoveryDigest)throw Error('ticket_association_original_changed');
  const originalRows=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;intakeJson:unknown}>>`SELECT "id","organizationId","version","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${a.original.releaseId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  const originalHead=originalRows[0];if(originalRows.length!==1||originalHead.id!==a.original.releaseId||originalHead.organizationId!==scope.organizationId||originalHead.version!==a.original.releaseVersion||sha256ContentHash({requestVersion:originalHead.version,intake:originalHead.intakeJson})!==a.original.intakeDigest)throw Error('ticket_association_original_request_changed');
  const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;intakeJson:unknown;requesterUserId:string}>>`SELECT "id","organizationId","version","intakeJson","requesterUserId" FROM "TauriDeploymentRequest" WHERE "id"=${a.deployment.binding.releaseId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  const head=rows[0];if(rows.length!==1||head.id!==a.deployment.binding.releaseId||head.organizationId!==scope.organizationId||head.version!==a.deployment.headReleaseVersion||sha256ContentHash({requestVersion:head.version,intake:head.intakeJson})!==a.deployment.headIntakeDigest)throw Error('ticket_association_head_changed');
  const connections=await tx.$queryRaw<Array<{id:string;organizationId:string;provider:string;status:string;revokedAt:Date|null;updatedAt:Date;externalAccountId:string|null;consentedByUserId:string|null}>>`SELECT "id","organizationId","provider","status","revokedAt","updatedAt","externalAccountId","consentedByUserId" FROM "TenantIntegrationConnection" WHERE "id"=${a.ticket.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
  const connection=connections[0];if(connections.length!==1||connection.id!==a.ticket.connectionId||connection.organizationId!==scope.organizationId||connection.provider!==a.ticket.provider||connection.status!=='active'||connection.revokedAt||connection.updatedAt.toISOString()!==a.ticket.connectionRevision||connection.consentedByUserId!==a.executorUserId||a.ticket.provider==='jira'&&connection.externalAccountId!==a.ticket.siteId)throw Error('ticket_association_connection_changed');
  const accepted=acceptedSchema.parse(await ports.readAccepted(tx,scope,a.deployment.acceptedOperationId)),p=accepted.plan,b=a.deployment.binding;
  if(accepted.operationId!==a.deployment.acceptedOperationId||accepted.deploymentPlanDigest!==sha256ContentHash(p)||p.organizationId!==scope.organizationId||p.releaseId!==b.releaseId||p.releaseVersion!==b.releaseVersion||p.intakeDigest!==b.intakeDigest||p.planId!==b.planId||p.connectionId!==b.connectionId||p.connectionRevision!==b.connectionRevision||p.repositoryFullName!==b.repositoryFullName||p.workflowPath!==b.workflowPath||p.ref!==b.dispatchedRef||p.sourceCommitSha!==b.sourceCommit||accepted.receipt.runId!==b.runId||accepted.receipt.runAttempt!==b.runAttempt||accepted.dispatchEvidenceDigest!==b.dispatchEvidenceDigest)throw Error('ticket_association_dispatch_changed');
  if(sha256ContentHash(await ports.readReviewedBinding(tx,scope,b))!==sha256ContentHash(b))throw Error('ticket_association_reviewed_plan_changed');
  const evidence=parseReleaseWorkflowEvidenceDto(await ports.readEvidence(tx,scope,a.deployment.evidenceId));
  if(evidence.id!==a.deployment.evidenceId||sha256ContentHash(evidence)!==a.deployment.evidenceDigest||sha256ContentHash(evidence.binding)!==sha256ContentHash(b)||evidence.state!=='observed'||evidence.observation?.status!=='completed'||evidence.observation.conclusion!=='success')throw Error('ticket_association_observation_changed');
  const receipt=await ports.readTicketReceipt(scope,a.ticket),observed=Date.parse(receipt.observedAt);
  if(receipt.digest!==a.ticketReadDigest||!Number.isFinite(observed)||observed>now()||now()-observed>30000)throw Error('ticket_association_ticket_read_expired');
  return structuredClone(a);
 };
}
