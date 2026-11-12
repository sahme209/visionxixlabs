import {z} from 'zod';
import {platformPreparationRequestId} from '../preparationContract';
import {operationalEvidenceId,operationalReleaseManifest} from './contracts';
export const manualReleaseSelection=z.object({manifestEvidenceId:operationalEvidenceId,expiresAt:z.string().max(40).datetime()}).strict();
export const manualReleaseId=z.string().regex(/^platform_manual_release_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
export const manualReleaseCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare'),selection:manualReleaseSelection,requestId:platformPreparationRequestId}).strict(),
 z.object({operation:z.literal('lookup'),requestId:platformPreparationRequestId}).strict(),
 z.object({operation:z.literal('inspect'),recordId:manualReleaseId}).strict(),
 z.object({operation:z.literal('review'),recordId:manualReleaseId,expectedVersion:z.literal(0),planDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({operation:z.literal('recordNotice'),recordId:manualReleaseId,expectedVersion:z.literal(1)}).strict(),
 z.object({operation:z.literal('inspectResult'),recordId:manualReleaseId,deploymentId:z.string().regex(/^dpl_[A-Za-z0-9_]{1,128}$/)}).strict(),
]);

export const manualReleaseHistory=z.object({recordId:manualReleaseId,manifest:operationalReleaseManifest.safeExtend({digest:z.string().regex(/^[a-f0-9]{64}$/),authority:z.literal('metadata_only'),executionAuthorized:z.literal(false),ownerAuthorization:z.literal('external_not_verified')}),inspectedAt:z.number().int().nonnegative().safe(),status:z.enum(['proposed','reviewed','notice_claimed','notice_recorded']),version:z.number().int().min(0).max(3),attemptCount:z.number().int().min(0).max(1),requesterUserId:z.string().min(1).max(256),reviewerUserId:z.string().min(1).max(256).nullable(),expired:z.boolean(),ownerAuthorization:z.literal('external_not_verified'),providerExecution:z.literal(false),authority:z.literal('history_only'),sourceValidation:z.literal('not_checked')}).strict().refine(v=>v.version===({proposed:0,reviewed:1,notice_claimed:2,notice_recorded:3}[v.status])&&v.attemptCount===(v.version>=2?1:0)&&(v.status==='proposed'?v.reviewerUserId===null:v.reviewerUserId!==null&&v.reviewerUserId!==v.requesterUserId)&&v.expired===(v.inspectedAt>=Date.parse(v.manifest.expiresAt)));
export type ManualReleaseHistory=z.infer<typeof manualReleaseHistory>;
export const manualReleasePreparationReceipt=z.object({recordId:manualReleaseId,requestId:platformPreparationRequestId,historical:z.boolean(),authority:z.literal('notice_reference_only')}).strict();
export const manualReleaseLookup=z.discriminatedUnion('found',[z.object({found:z.literal(true),recordId:manualReleaseId,requestId:platformPreparationRequestId,authority:z.literal('history_only')}).strict(),z.object({found:z.literal(false),requestId:platformPreparationRequestId,authority:z.literal('history_only')}).strict()]);
export const manualReleaseReviewReceipt=z.object({reviewRecorded:z.literal(true),providerExecution:z.literal(false),executionAuthorized:z.literal(false)}).strict();

export const manualReleaseResult=z.object({recordId:manualReleaseId,deploymentId:z.string().regex(/^dpl_[A-Za-z0-9_]{1,128}$/),receiptId:operationalEvidenceId,state:z.enum(['verified_ready','unknown','terminal_failure','pending']),providerState:z.enum(['ACCEPTED','QUEUED','BUILDING','READY','ERROR','CANCELED','UNKNOWN']),observedAt:z.string().max(40).datetime(),reviewExpired:z.boolean(),providerExecution:z.literal(false),executionAuthorized:z.literal(false),rollbackAuthorized:z.literal(false),ownerAuthorization:z.literal('external_not_verified')}).strict().refine(v=>v.state===(v.providerState==='READY'?'verified_ready':v.providerState==='UNKNOWN'?'unknown':['ERROR','CANCELED'].includes(v.providerState)?'terminal_failure':'pending'));
export type ManualReleaseResult=z.infer<typeof manualReleaseResult>;
