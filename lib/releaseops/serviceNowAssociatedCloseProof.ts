import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {serviceNowTerminalPolicySchema,ticketReleaseAssociationSchema,type TicketReviewScope} from './ticketGovernanceReviewContract';
import {ticketGovernanceReferenceSchema,type TicketGovernanceReference} from './ticketGovernanceReference';
import {parseServiceNowTicketActionCandidate} from './serviceNowTicketLifecycleContract';
import {buildAssociatedTicketLink} from './associatedTicketCandidate';
import {verifyAssociatedTicketLink,type ApprovedTicketAssociationReader} from './associatedTicketProof';
export type ApprovedTerminalPolicyReader=(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,reference:TicketGovernanceReference)=>Promise<unknown>;
const base={kind:z.literal('verified_ticket_governance_review_v1'),reviewId:z.string(),bindingDigest:z.string(),approverUserId:z.string().min(1)};
const associationProof=z.object({...base,binding:ticketReleaseAssociationSchema}).strict();
const policyProof=z.object({...base,binding:serviceNowTerminalPolicySchema}).strict();
export function matchHistoricalServiceNowLink(raw:unknown,next:unknown){
 const old=parseServiceNowTicketActionCandidate(raw),fresh=parseServiceNowTicketActionCandidate(next);
 if(old.kind!=='link'||fresh.kind!=='link'||!old.association||!fresh.association||['organizationId','releaseId','releaseVersion','sourceDigest','connectionId','instanceOrigin','family','schemaDigest','publishActionId','payloadDigest','issue','evidence','payload'].some(k=>sha256ContentHash((old as Record<string,unknown>)[k])!==sha256ContentHash((fresh as Record<string,unknown>)[k])))throw Error('servicenow_historical_link_changed');
}
/** Recovered publication and historical journal success are evidence only. Current
 * association AND independently approved admin policy are reloaded under locks.
 * This does not infer terminal states or authorize a native transition. */
export async function verifyAssociatedServiceNowClosure(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,raw:unknown,historicalLink:unknown,original:{actionId:string;version:number;candidate:unknown;executorUserId:string;issue:unknown;recovery:unknown|null},readAssociation:ApprovedTicketAssociationReader|undefined,readPolicy:ApprovedTerminalPolicyReader|undefined,now:number){
 const c=parseServiceNowTicketActionCandidate(raw),published=parseServiceNowTicketActionCandidate(original.candidate);if(published.kind!=='publish')throw Error('servicenow_original_process_required');if(c.kind!=='close'||!c.association||!c.terminalPolicy||!c.linkedEvidenceActionId||!readAssociation||!readPolicy)throw Error('servicenow_closure_reviews_required');
 const a=associationProof.parse(await readAssociation(tx,scope,c.association)),fresh=buildAssociatedTicketLink(c.association,a.binding,original.candidate,now);
 await verifyAssociatedTicketLink(tx,scope,fresh,original,readAssociation,now);matchHistoricalServiceNowLink(historicalLink,fresh);
 if(!('instanceOrigin'in fresh)||['organizationId','releaseId','releaseVersion','sourceDigest','connectionId','connectionRevision','instanceOrigin','family','publishActionId','issue'].some(k=>sha256ContentHash((c as Record<string,unknown>)[k])!==sha256ContentHash((fresh as Record<string,unknown>)[k]))||Date.parse(c.expiresAt)>Date.parse(fresh.expiresAt))throw Error('servicenow_associated_closure_changed');
 const reference=ticketGovernanceReferenceSchema.parse(c.terminalPolicy),proof=policyProof.parse(await readPolicy(tx,scope,reference)),p=proof.binding;
 if(proof.reviewId!==reference.reviewId||proof.bindingDigest!==reference.bindingDigest||sha256ContentHash(p)!==reference.bindingDigest||p.organizationId!==scope.organizationId||p.executorUserId!==original.executorUserId||[p.requesterUserId,p.executorUserId].includes(proof.approverUserId)||Date.parse(p.expiresAt)<=now||Date.parse(c.expiresAt)>Date.parse(p.expiresAt)||p.connectionId!==c.connectionId||p.connectionRevision!==c.connectionRevision||p.instanceOrigin!==c.instanceOrigin||sha256ContentHash(p.nativeProcess)!==sha256ContentHash(published.nativeProcess)||sha256ContentHash(p.nativeProcess)!==sha256ContentHash(c.transition.nativeProcess)||!p.terminalStates.some(s=>s.value===c.payload.state&&s.label===c.transition.targetStateLabel)||c.schemaDigest!==sha256ContentHash({reviewId:reference.reviewId,bindingDigest:reference.bindingDigest,nativeProcess:p.nativeProcess,fields:p.fields}))throw Error('servicenow_terminal_policy_changed');
 for(const f of p.fields){const value=c.payload[f.name];if(f.required&&(!value||!value.trim())||value!==undefined&&(!f.writable||f.type!=='string'||f.maxBytes!==undefined&&Buffer.byteLength(value)>f.maxBytes||f.choices&&!f.choices.some(x=>x.value===value)))throw Error('servicenow_terminal_policy_fields_changed')}
 for(const name of ['close_code','close_notes']as const)if(c.payload[name]!==undefined&&!p.fields.some(f=>f.name===name))throw Error('servicenow_terminal_policy_fields_changed');
}
