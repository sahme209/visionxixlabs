import {z} from 'zod';
import {digest} from './contracts';
import {platformActionId,platformInspectionSchema} from './viewContract';
/** Structural public contracts only: parsing does not qualify sources, receipts,
 * channels or permission to execute. This module contains no private I/O. */
const stamp=z.number().int().nonnegative().safe(),positive=z.number().int().positive().safe();
const index=z.number().int().min(0).max(31);
export const templateSelectionBase={accountId:z.string().regex(/^\d{12}$/),region:z.enum(['us-east-1','us-east-2']),expiresAt:z.string().datetime()};
export const templateWorkflowSelection=z.discriminatedUnion('operation',[
 z.object({...templateSelectionBase,operation:z.literal('create_bucket')}).strict(),z.object({...templateSelectionBase,operation:z.literal('upload')}).strict(),
 z.object({...templateSelectionBase,operation:z.literal('access'),objectVersion:z.string().min(1).max(256).refine(v=>v!=='null'&&v.trim()===v&&!/[\x00-\x1f]/.test(v)),ttlSeconds:z.number().int().min(1).max(3600),delivery:z.literal('original_requester_session')}).strict()
]);
const templateReceiptDetail=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('bucket'),providerStatus:z.literal(200)}).strict(),
 z.object({kind:z.literal('object'),providerStatus:z.literal(200),objectVersion:z.string().min(1).max(1024).refine(v=>v!=='null'),versioningEnabled:z.literal(true)}).strict(),
 z.object({kind:z.literal('access'),grantId:z.string().regex(/^platform_template_grant_[a-f0-9]{64}$/),artifactRef:z.string().regex(/^platform_template_artifact_[a-f0-9-]{36}$/),artifactProfileDigest:digest,signedAt:stamp,ttlSeconds:positive.max(3600),hardExpiresAt:stamp,clockSkewMs:positive}).strict()
]);
export const templateReceiptBody=z.object({format:z.literal(1),purpose:z.literal('platform_template_execution_receipt_v1'),receiptId:z.string().regex(/^platform_template_receipt_[a-f0-9-]{36}$/),nativeKey:digest,bindingDigest:digest,actionId:platformActionId,effectIndex:index,planDigest:digest,sourceDigest:digest,profileDigest:digest,generation:positive,operation:z.enum(['create_bucket','upload','access']),outcome:z.enum(['confirmed','refused','unknown']),observedAt:stamp,detail:templateReceiptDetail.nullable()}).strict();

export const templatePublicReceipt=templateReceiptBody.extend({receiptDigest:digest}).strict();
const artifactRef=z.string().regex(/^platform_template_artifact_[a-f0-9-]{36}$/);
export const templateWorkflowCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare'),requestReference:z.string().uuid(),selection:templateWorkflowSelection}).strict(),
 z.object({operation:z.literal('lookup'),requestReference:z.string().uuid()}).strict(),
 z.object({operation:z.literal('inspect'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('preview'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('review'),actionId:platformActionId,expectedVersion:z.literal(0),planDigest:digest}).strict(),
 z.object({operation:z.literal('execute'),actionId:platformActionId,expectedVersion:z.literal(1),planDigest:digest}).strict(),
 z.object({operation:z.literal('deliver'),actionId:platformActionId,planDigest:digest,artifactRef}).strict(),
]);
export type TemplateWorkflowCommand=z.infer<typeof templateWorkflowCommand>;

const deliveryClaim=z.object({artifactRef,generation:positive,phase:z.literal('output_attempt_claimed'),attempt:z.literal(1),claimedAt:stamp,clientReceiptConfirmed:z.literal(false)}).strict();
export const templateWorkflowHistory=z.object({action:platformInspectionSchema,receipts:z.array(templatePublicReceipt).max(1),deliveries:z.array(deliveryClaim).max(1),authority:z.literal('template_history_only'),sourceValidation:z.literal('not_checked'),executionAuthorized:z.literal(false)}).strict().superRefine((v,c)=>{
 const bad=()=>c.addIssue({code:'custom',message:'Inconsistent template history'}),a=v.action,e=a.plan.effects[0];
 if(a.plan.effects.length!==1||!['template.bucket.create','template.object.put','template.access.grant'].includes(e.kind))bad();
 if(a.status==='confirmed'&&v.receipts.length!==1)bad();
 for(const r of v.receipts){const operation=e.kind==='template.bucket.create'?'create_bucket':e.kind==='template.object.put'?'upload':'access';if(r.actionId!==a.actionId||r.planDigest!==a.plan.digest||r.sourceDigest!==a.plan.sourceDigest||r.effectIndex!==0||r.operation!==operation||r.outcome!==a.status||a.effects[0].status!==r.outcome)bad();if(r.outcome==='confirmed'){if(!r.detail||({bucket:'create_bucket',object:'upload',access:'access'}[r.detail.kind])!==r.operation)bad()}else if(r.detail!==null)bad()}
 for(const claim of v.deliveries){const r=v.receipts[0],detail=r?.detail;if(a.status!=='confirmed'||detail?.kind!=='access'||detail.artifactRef!==claim.artifactRef||r.generation!==claim.generation||claim.claimedAt<r.observedAt||claim.claimedAt>=detail.hardExpiresAt)bad()}
});
export type TemplateWorkflowHistory=z.infer<typeof templateWorkflowHistory>;
export const templateWorkflowPreview=z.object({action:platformInspectionSchema,bindingDigest:digest,profileDigest:digest,artifactProfileDigest:digest.nullable(),delivery:z.literal('original_requester_session').nullable(),content:z.discriminatedUnion('kind',[
 z.object({kind:z.literal('bucket'),ownership:z.literal('not_observed')}).strict(),
 z.object({kind:z.literal('source'),yaml:z.string().min(1).max(256*1024),bytesDigest:digest}).strict(),
]),authority:z.literal('review_preview_only'),executionAuthorized:z.literal(false)}).strict().superRefine((v,c)=>{const a=v.action,e=a.plan.effects[0],bad=()=>c.addIssue({code:'custom',message:'Inconsistent template preview'});if(a.expired||!['proposed','approved'].includes(a.status)||a.plan.effects.length!==1)bad();if(e.kind==='template.bucket.create'){if(v.content.kind!=='bucket'||v.delivery!==null||v.artifactProfileDigest!==null)bad()}else if(e.kind==='template.object.put'||e.kind==='template.access.grant'){if(v.content.kind!=='source'||v.content.bytesDigest!==e.target.bytesDigest)bad();if(e.kind==='template.access.grant'){if(v.delivery!=='original_requester_session'||v.artifactProfileDigest===null)bad()}else if(v.delivery!==null||v.artifactProfileDigest!==null)bad()}else bad()});
export type TemplateWorkflowPreview=z.infer<typeof templateWorkflowPreview>;
export const templateWorkflowOutput=z.object({actionId:platformActionId,artifactRef,url:z.string().min(1).max(8192).refine(v=>{try{const u=new URL(v);return new TextEncoder().encode(v).length<=8192&&u.protocol==='https:'&&!u.username&&!u.password&&!u.hash}catch{return false}}),hardExpiresAt:stamp,serverOutputAttempted:z.literal(true),clientReceiptConfirmed:z.literal(false),authority:z.literal('one_use_original_session_output')}).strict();
export type TemplateWorkflowOutput=z.infer<typeof templateWorkflowOutput>;
