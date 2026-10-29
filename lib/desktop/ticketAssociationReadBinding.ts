import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketAssociationTargetSchema,type TicketReleaseAssociation} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {parseJiraTicketActionCandidate} from '@/lib/releaseops/jiraTicketLifecycleContract';
import {parseServiceNowTicketActionCandidate} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
/** Rebind only a READ to the current revision of the SAME connection/site and
 * exact audited ticket. Never changes original publish provenance or an action. */
export function bindPublishedTicketReadCandidate(organizationId:string,rawTarget:TicketReleaseAssociation['ticket'],original:{candidate:unknown;issue:unknown;executorUserId:string}){
 const target=ticketAssociationTargetSchema.parse(rawTarget),candidate=target.provider==='jira'?parseJiraTicketActionCandidate(original.candidate):parseServiceNowTicketActionCandidate(original.candidate);
 if(candidate.kind!=='publish'||candidate.organizationId!==organizationId||candidate.connectionId!==target.connectionId||sha256ContentHash(original.issue)!==sha256ContentHash(target.issue)||!original.executorUserId||('siteId'in candidate?target.provider!=='jira'||candidate.siteId!==target.siteId:target.provider!=='servicenow'||candidate.instanceOrigin!==target.instanceOrigin))throw Error('ticket_original_read_binding_changed');
 const raw={...candidate,connectionRevision:target.connectionRevision};
 return{candidate:target.provider==='jira'?parseJiraTicketActionCandidate(raw):parseServiceNowTicketActionCandidate(raw),executorUserId:original.executorUserId};
}
