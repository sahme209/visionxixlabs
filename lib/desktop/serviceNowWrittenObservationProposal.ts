import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseServiceNowTicketActionCandidate} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {type TicketGovernanceReference} from '@/lib/releaseops/ticketGovernanceReference';
import {ticketReviewScopeSchema,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {serviceNowWrittenLinkObservationSchema,serviceNowWrittenObservationRequestSchema} from '@/lib/releaseops/serviceNowWrittenLinkObservationContract';
import {buildServiceNowWrittenLinkObservation,serviceNowUnknownLinkSourceSchema,serviceNowWrittenAssociationSourceSchema} from '@/lib/releaseops/serviceNowWrittenLinkObservation';
const actionId=z.string().regex(/^servicenow_action_[a-f0-9]{64}$/);
interface Ports{
 assertCurrent:(scope:TicketReviewScope,signal:AbortSignal)=>Promise<void>;
 readUnknown:(scope:TicketReviewScope,id:string,version:number,signal:AbortSignal)=>Promise<unknown>;
 readAssociation:(scope:TicketReviewScope,reference:TicketGovernanceReference,signal:AbortSignal)=>Promise<unknown>;
 /** Trusted fixed GET-only adapter, using the loaded action and approved association. */
 readProof:(scope:TicketReviewScope,source:{action:unknown;association:unknown},signal:AbortSignal)=>Promise<unknown>;
 now?:()=>number;
}
/** Client selects records only. Proof, identity and all immutable source facts
 * are server loaded; preparing this review cannot claim or dispatch anything. */
export function createServiceNowWrittenObservationProposal(ports:Ports){return async(rawScope:TicketReviewScope,rawRequest:unknown,parent:AbortSignal)=>{
 const scope=ticketReviewScopeSchema.parse(rawScope),request=serviceNowWrittenObservationRequestSchema.parse(rawRequest),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]),now=ports.now??Date.now;
 async function fence(){signal.throwIfAborted();await withGithubAbort(ports.assertCurrent(scope,signal),signal);signal.throwIfAborted()}
 await fence();const action=await withGithubAbort(ports.readUnknown(scope,request.actionId,request.expectedVersion,signal),signal);await fence();
 const selection=serviceNowUnknownLinkSourceSchema.parse(action),candidate=parseServiceNowTicketActionCandidate(selection.candidate);
 if(candidate.kind!=='link'||!candidate.association||candidate.organizationId!==scope.organizationId||selection.id!==request.actionId||selection.version!==request.expectedVersion||selection.requesterUserId!==scope.actorUserId||selection.executorUserId!==scope.actorUserId)throw Error('ticket_observation_source_changed');
 const association=await withGithubAbort(ports.readAssociation(scope,request.association,signal),signal);await fence();
 const reference=serviceNowWrittenAssociationSourceSchema.parse(association),b=reference.binding;
 if(b.organizationId!==scope.organizationId||b.ticket.provider!=='servicenow'||b.requesterUserId!==scope.actorUserId||b.executorUserId!==scope.actorUserId||[b.requesterUserId,b.executorUserId].includes(reference.approverUserId)||sha256ContentHash(b)!==reference.bindingDigest||Date.parse(b.expiresAt)<=now()||b.ticket.connectionId!==candidate.connectionId||b.ticket.instanceOrigin!==candidate.instanceOrigin||sha256ContentHash(b.ticket.issue)!==sha256ContentHash(candidate.issue)||reference.reviewId!==request.association.reviewId||reference.bindingDigest!==request.association.bindingDigest)throw Error('ticket_observation_association_changed');
 const proof=await withGithubAbort(ports.readProof(scope,{action,association},signal),signal);await fence();
 const{digest,...binding}=buildServiceNowWrittenLinkObservation({organizationId:scope.organizationId,actorUserId:scope.actorUserId,action,association,proof,now:now()});
 return serviceNowWrittenLinkObservationSchema.parse(binding);
}};
