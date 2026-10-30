import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketReleaseAssociationSchema,type TicketReviewScope} from './ticketGovernanceReviewContract';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {ticketGovernanceReferenceSchema,type TicketGovernanceReference} from './ticketGovernanceReference';
import {buildAssociatedTicketLink} from './associatedTicketCandidate';
export type ApprovedTicketAssociationReader=(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,reference:TicketGovernanceReference)=>Promise<unknown>;
const proofSchema=z.object({kind:z.literal('verified_ticket_governance_review_v1'),reviewId:z.string(),bindingDigest:z.string(),approverUserId:z.string().min(1),binding:ticketReleaseAssociationSchema}).strict();
/** A marker cannot authorize itself: exact independently approved provenance must
 * be reloaded under the caller's transaction locks by trusted server composition. */
export async function verifyAssociatedTicketLink(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,candidate:unknown,original:{actionId:string;version:number;candidate:unknown;executorUserId:string;issue:unknown;recovery:unknown|null},read:ApprovedTicketAssociationReader|undefined,now:number){
 if(!read)throw Error('ticket_association_review_unavailable');
 const reference=ticketGovernanceReferenceSchema.parse((candidate as {association?:unknown})?.association),proof=proofSchema.parse(await read(tx,scope,reference)),a=proof.binding;
 if(proof.reviewId!==reference.reviewId||proof.bindingDigest!==reference.bindingDigest||sha256ContentHash(a)!==reference.bindingDigest||a.organizationId!==scope.organizationId||[a.requesterUserId,a.executorUserId].includes(proof.approverUserId)||a.original.actionId!==original.actionId||a.original.actionVersion!==original.version||a.executorUserId!==original.executorUserId||sha256ContentHash(a.ticket.issue)!==sha256ContentHash(original.issue)||(original.recovery?sha256ContentHash(original.recovery):null)!==a.original.recoveryDigest)throw Error('ticket_association_review_changed');
 if(sha256ContentHash(buildAssociatedTicketLink(reference,a,original.candidate,now))!==sha256ContentHash(candidate))throw Error('ticket_associated_candidate_changed');
}

/** Historical success is immutable evidence, not current execution authority.
 * Only a fresh independently approved association can rebind closure; never
 * dispatch or replace the old link merely to renew an approval window. */
export function matchHistoricalJiraLink(historical:unknown,fresh:unknown){
 const old=historical as Record<string,unknown>,next=fresh as Record<string,unknown>;
 if(old.kind!=='link'||next.kind!=='link'||!old.association||!next.association||!('siteId'in old)||!('siteId'in next)||['organizationId','releaseId','releaseVersion','sourceDigest','connectionId','siteId','publishActionId','payloadDigest','issue','evidence','payload'].some(k=>sha256ContentHash(old[k])!==sha256ContentHash(next[k])))throw Error('ticket_historical_link_changed');
}
export async function verifyAssociatedTicketClosure(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,rawClose:unknown,historicalLink:unknown,original:{actionId:string;version:number;candidate:unknown;executorUserId:string;issue:unknown;recovery:unknown|null},read:ApprovedTicketAssociationReader|undefined,now:number){
 if(!read)throw Error('ticket_association_review_unavailable');const c=rawClose as Record<string,unknown>,reference=ticketGovernanceReferenceSchema.parse(c.association),proof=proofSchema.parse(await read(tx,scope,reference)),fresh=buildAssociatedTicketLink(reference,proof.binding,original.candidate,now);
 await verifyAssociatedTicketLink(tx,scope,fresh,original,read,now);matchHistoricalJiraLink(historicalLink,fresh);
 if(c.kind!=='close'||!('siteId'in c)||['organizationId','releaseId','releaseVersion','sourceDigest','connectionId','connectionRevision','siteId','expiresAt','publishActionId','issue'].some(k=>sha256ContentHash(c[k])!==sha256ContentHash((fresh as Record<string,unknown>)[k])))throw Error('ticket_associated_closure_changed');
}
