import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketGovernanceReferenceSchema} from './ticketGovernanceReference';
import {ticketReviewScopeSchema} from './ticketGovernanceReviewContract';
import {serviceNowWrittenLinkObservationSchema} from './serviceNowWrittenLinkObservationContract';
import {serviceNowUnknownLinkSourceSchema} from './serviceNowWrittenLinkObservation';
import {parseServiceNowTicketActionCandidate} from './serviceNowTicketLifecycleContract';
const proofSchema=z.object({kind:z.literal('verified_ticket_governance_review_v1'),...ticketGovernanceReferenceSchema.shape,approverUserId:z.string().min(1),binding:serviceNowWrittenLinkObservationSchema}).strict();
/** Consumes only a trusted current readApproved result. Its source adapter must
 * revalidate exact journal presence before locks and all durable source facts
 * under locks. This adds provenance, not a transport confirmation or write grant. */
export function verifyServiceNowWrittenLinkProof(rawScope:unknown,rawAction:unknown,rawReference:unknown,rawProof:unknown,now:number){
 const scope=ticketReviewScopeSchema.parse(rawScope),action=serviceNowUnknownLinkSourceSchema.parse(rawAction),reference=ticketGovernanceReferenceSchema.parse(rawReference),proof=proofSchema.parse(rawProof),b=proof.binding,c=parseServiceNowTicketActionCandidate(action.candidate);
 if(c.kind!=='link'||!c.association||!Number.isFinite(now)||b.organizationId!==scope.organizationId||c.organizationId!==scope.organizationId||proof.reviewId!==reference.reviewId||proof.bindingDigest!==reference.bindingDigest||sha256ContentHash(b)!==reference.bindingDigest||[b.requesterUserId,b.executorUserId].includes(proof.approverUserId)||b.requesterUserId!==action.requesterUserId||b.executorUserId!==action.executorUserId||b.originalActionId!==action.id||b.originalVersion!==action.version||b.originalCandidateDigest!==sha256ContentHash(c)||b.payloadDigest!==c.payloadDigest||b.connectionId!==c.connectionId||b.instanceOrigin!==c.instanceOrigin||sha256ContentHash(b.issue)!==sha256ContentHash(c.issue)||b.proof.entryDigest!==sha256ContentHash(c.payload.work_notes)||Date.parse(b.expiresAt)<=now)throw Error('servicenow_written_link_proof_changed');
 return b;
}
