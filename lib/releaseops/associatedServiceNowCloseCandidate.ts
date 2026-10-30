import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {serviceNowTerminalPolicySchema} from './ticketGovernanceReviewContract';
import {ticketGovernanceReferenceSchema} from './ticketGovernanceReference';
import {parseServiceNowTicketActionCandidate} from './serviceNowTicketLifecycleContract';
import {buildServiceNowNativeClosePlan} from '@/lib/desktop/serviceNowTicketLifecyclePreparation';
/** Current native choice + existing approved source context. A reference alone
 * is not authority: the durable store separately revalidates both human reviews. */
export function buildAssociatedServiceNowCloseCandidate(rawLink:unknown,linkedEvidenceActionId:string,rawPolicyReference:unknown,rawPolicy:unknown,metadata:unknown,values:unknown,now=Date.now()){
 const link=parseServiceNowTicketActionCandidate(rawLink),terminalPolicy=ticketGovernanceReferenceSchema.parse(rawPolicyReference),policy=serviceNowTerminalPolicySchema.parse(rawPolicy);
 if(link.kind!=='link'||!link.association||!/^servicenow_action_[a-f0-9]{64}$/.test(linkedEvidenceActionId)||terminalPolicy.bindingDigest!==sha256ContentHash(policy)||policy.organizationId!==link.organizationId||policy.connectionId!==link.connectionId||policy.connectionRevision!==link.connectionRevision||policy.instanceOrigin!==link.instanceOrigin||Date.parse(policy.expiresAt)<=now||Date.parse(link.expiresAt)<=now)throw Error('servicenow_associated_close_source_changed');
 const native=buildServiceNowNativeClosePlan({organizationId:link.organizationId,connectionId:link.connectionId,connectionRevision:link.connectionRevision,instanceOrigin:link.instanceOrigin,consentedByUserId:policy.executorUserId},link.issue,metadata,values,now);
 const expectedSchema=sha256ContentHash({reviewId:terminalPolicy.reviewId,bindingDigest:terminalPolicy.bindingDigest,nativeProcess:policy.nativeProcess,fields:policy.fields});
 if(native.schemaDigest!==expectedSchema||sha256ContentHash(native.transition.nativeProcess)!==sha256ContentHash(policy.nativeProcess)||!policy.terminalStates.some(s=>s.value===native.payload.state&&s.label===native.transition.targetStateLabel))throw Error('servicenow_associated_close_policy_changed');
 return parseServiceNowTicketActionCandidate({organizationId:link.organizationId,releaseId:link.releaseId,releaseVersion:link.releaseVersion,connectionId:link.connectionId,connectionRevision:link.connectionRevision,instanceOrigin:link.instanceOrigin,family:'change_request',kind:'close',publishActionId:link.publishActionId,issue:link.issue,sourceDigest:link.sourceDigest,schemaDigest:native.schemaDigest,association:link.association,linkedEvidenceActionId,terminalPolicy,transition:native.transition,payload:native.payload,payloadDigest:native.payloadDigest,expiresAt:new Date(Math.min(Date.parse(link.expiresAt),Date.parse(policy.expiresAt))).toISOString()});
}
