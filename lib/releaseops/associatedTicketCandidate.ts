import {jiraTicketRemoteLinkId} from './jiraTicketTransport';
import 'server-only';
import {TICKET_ASSOCIATION_WINDOW_MS,ticketProviderActionExpiry} from './ticketReviewWindows';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketReleaseAssociationSchema} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {ticketGovernanceReferenceSchema} from '@/lib/releaseops/ticketGovernanceReference';
import {parseJiraTicketActionCandidate} from '@/lib/releaseops/jiraTicketLifecycleContract';
import {parseServiceNowTicketActionCandidate,serviceNowEvidenceWorkNote} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
/** Trusted composition only. A reference is not approval: callers must revalidate
 * it through the governance store under the lifecycle transaction's locks. */
export function buildAssociatedTicketLink(rawReference:unknown,rawBinding:unknown,rawOriginal:unknown,now=Date.now(),recordedDeadline?:string){
 const association=ticketGovernanceReferenceSchema.parse(rawReference),a=ticketReleaseAssociationSchema.parse(rawBinding),original=a.ticket.provider==='jira'?parseJiraTicketActionCandidate(rawOriginal):parseServiceNowTicketActionCandidate(rawOriginal);
 if(association.bindingDigest!==sha256ContentHash(a)||original.kind!=='publish'||original.organizationId!==a.organizationId||original.releaseId!==a.original.releaseId||original.releaseVersion!==a.original.releaseVersion||original.sourceDigest!==a.original.intakeDigest||original.payloadDigest!==a.original.payloadDigest||sha256ContentHash(original.payload)!==a.original.payloadDigest||original.connectionId!==a.ticket.connectionId||!Number.isFinite(now)||now>=Date.parse(a.expiresAt)||Date.parse(a.expiresAt)-now>TICKET_ASSOCIATION_WINDOW_MS||('siteId'in original?a.ticket.provider!=='jira'||original.siteId!==a.ticket.siteId:a.ticket.provider!=='servicenow'||original.instanceOrigin!==a.ticket.instanceOrigin))throw Error('ticket_associated_source_changed');
 const b=a.deployment.binding,evidence={id:a.deployment.evidenceId,digest:a.deployment.evidenceDigest,provider:'github_actions' as const,runId:b.runId,runAttempt:b.runAttempt,headSha:b.sourceCommit,conclusion:'success' as const,url:`https://github.com/${b.repositoryFullName}/actions/runs/${b.runId}`};
 const common={kind:'link',organizationId:a.organizationId,releaseId:a.original.releaseId,releaseVersion:a.original.releaseVersion,sourceDigest:a.original.intakeDigest,connectionId:a.ticket.connectionId,connectionRevision:a.ticket.connectionRevision,expiresAt:ticketProviderActionExpiry(a.expiresAt,now,recordedDeadline),publishActionId:a.original.actionId,issue:a.ticket.issue,evidence,association};
 if(a.ticket.provider==='jira'){
  const payload={globalId:jiraTicketRemoteLinkId({organizationId:a.organizationId,releaseId:a.original.releaseId,issueId:a.ticket.issue.id,evidenceId:evidence.id}),object:{url:evidence.url,title:`Axiom deployment run ${b.runId} (attempt ${b.runAttempt})`}};
  return parseJiraTicketActionCandidate({...common,siteId:a.ticket.siteId,payload,payloadDigest:sha256ContentHash(payload)});
 }
 if(!('schemaDigest'in original))throw Error('ticket_associated_source_changed');
 const payload={work_notes:serviceNowEvidenceWorkNote(evidence,'servicenow_action_'+sha256ContentHash({organizationId:a.organizationId,releaseId:a.original.releaseId,kind:'link',evidenceId:evidence.id}))};
 return parseServiceNowTicketActionCandidate({...common,instanceOrigin:a.ticket.instanceOrigin,family:'change_request',schemaDigest:original.schemaDigest,payload,payloadDigest:sha256ContentHash(payload)});
}
