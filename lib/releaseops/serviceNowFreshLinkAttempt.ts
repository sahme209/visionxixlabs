import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {serviceNowEvidenceWorkNote,type ServiceNowTicketActionCandidate} from './serviceNowTicketLifecycleContract';
import {serviceNowFreshAttemptReferenceSchema,type ServiceNowFreshAttemptReference} from './serviceNowFreshAttemptReference';
type Link=Extract<ServiceNowTicketActionCandidate,{kind:'link'}>;
type FreshLink=Link&{freshAttempt?:ServiceNowFreshAttemptReference};
export function serviceNowLogicalLinkActionId(c:Link){return 'servicenow_action_'+sha256ContentHash({organizationId:c.organizationId,releaseId:c.releaseId,kind:'link',evidenceId:c.evidence.id})}
/** One child per immutable refused parent version, not one per request nonce. */
export function serviceNowFreshLinkAttemptId(c:FreshLink){const r=serviceNowFreshAttemptReferenceSchema.parse(c.freshAttempt);if(r.logicalActionId!==serviceNowLogicalLinkActionId(c)||r.parentActionId!==r.logicalActionId)throw Error('servicenow_fresh_attempt_invalid');const ordinary='servicenow_action_'+sha256ContentHash({kind:'fresh_servicenow_link_v1',parentActionId:r.parentActionId,parentVersion:r.parentVersion,parentCandidateDigest:r.parentCandidateDigest,logicalActionId:r.logicalActionId});if(!r.correction)return ordinary;if(r.correction.refusedChildActionId!==ordinary)throw Error('servicenow_corrective_child_changed');return 'servicenow_action_'+sha256ContentHash({kind:'corrective_servicenow_link_v1',root:r.parentActionId,rootVersion:r.parentVersion,rootDigest:r.parentCandidateDigest,...r.correction})}
export interface ServiceNowFreshLinkParent {id:string;version:number;status:string;attemptCount:number;providerWritePerformed:boolean|null;transportMode:string;requesterUserId:string;executorUserId:string;candidate:ServiceNowTicketActionCandidate}
export function verifyServiceNowFreshLinkParent(parent:ServiceNowFreshLinkParent,child:FreshLink,requester:string,executor:string){
 const r=serviceNowFreshAttemptReferenceSchema.parse(child.freshAttempt),p=parent.candidate as FreshLink;
 if(r.correction||p.kind!=='link'||!p.association||p.freshAttempt||!child.association||parent.status!=='refused'||parent.attemptCount!==1||parent.providerWritePerformed!==false||parent.transportMode!=='provider'||parent.id!==r.parentActionId||parent.version!==r.parentVersion||sha256ContentHash(parent.candidate)!==r.parentCandidateDigest||parent.requesterUserId!==requester||parent.executorUserId!==executor||requester!==executor)throw Error('servicenow_fresh_attempt_parent_unavailable');
 const intent=(c:Link)=>({organizationId:c.organizationId,releaseId:c.releaseId,releaseVersion:c.releaseVersion,kind:c.kind,connectionId:c.connectionId,instanceOrigin:c.instanceOrigin,publishActionId:c.publishActionId,issue:c.issue,evidence:c.evidence,payload:c.payload,payloadDigest:c.payloadDigest});
 if(sha256ContentHash(intent(p))!==sha256ContentHash(intent(child))||serviceNowLogicalLinkActionId(p)!==r.logicalActionId||child.payload.work_notes!==serviceNowEvidenceWorkNote(child.evidence,r.logicalActionId))throw Error('servicenow_fresh_attempt_intent_changed');
 serviceNowFreshLinkAttemptId(child);
}

/** Exactly one correction after the original's sole ordinary child; never a chain. */
export function verifyServiceNowCorrectiveLinkParents(root:ServiceNowFreshLinkParent,child:ServiceNowFreshLinkParent,corrective:FreshLink,requester:string,executor:string){
 const r=serviceNowFreshAttemptReferenceSchema.parse(corrective.freshAttempt),fix=r.correction,c=child.candidate as FreshLink;if(!fix||c.kind!=='link'||!c.freshAttempt||c.freshAttempt.correction)throw Error('servicenow_corrective_parent_unavailable');
 const {correction:_,...ordinary}=r;verifyServiceNowFreshLinkParent(root,{...corrective,freshAttempt:ordinary},requester,executor);verifyServiceNowFreshLinkParent(root,c,requester,executor);
 if(child.status!=='refused'||child.attemptCount!==1||child.providerWritePerformed!==false||child.transportMode!=='provider'||child.requesterUserId!==requester||child.executorUserId!==executor||child.id!==fix.refusedChildActionId||child.version!==fix.refusedChildVersion||sha256ContentHash(child.candidate)!==fix.refusedChildCandidateDigest||serviceNowFreshLinkAttemptId(c)!==child.id||sha256ContentHash(c.freshAttempt)!==sha256ContentHash(ordinary))throw Error('servicenow_corrective_parent_changed');
 serviceNowFreshLinkAttemptId(corrective);
}
