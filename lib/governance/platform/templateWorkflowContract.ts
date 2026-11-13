import {z} from 'zod';
import {digest} from './contracts';
import {platformActionId} from './viewContract';
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
