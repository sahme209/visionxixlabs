import {z} from 'zod';
import {templateReceiptBody as receiptBody} from './templateWorkflowContract';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {digest,platformEffectSchema} from './contracts';
import {platformActionId} from './viewContract';
import {templateBucketName,templateObjectKey,templateRegion} from '@/lib/cloud/aws/platformTemplatePlan';
const stamp=z.number().int().nonnegative().safe(), positive=z.number().int().positive().safe();
const principal=z.object({userId:z.string().min(1).max(256),sessionId:z.string().min(1).max(256)}).strict();
const index=z.number().int().min(0).max(31);
const access=z.object({delivery:z.literal('original_requester_session'),grantId:z.string().regex(/^platform_template_grant_[a-f0-9]{64}$/),artifactProfileDigest:digest,clockSkewMs:positive}).strict();
const body=z.object({format:z.literal(1),purpose:z.literal('platform_template_execution_binding_v1'),actionId:platformActionId,effectIndex:index,planDigest:digest,sourceDigest:digest,profileDigest:digest,approvalExpiresAt:z.string().datetime(),effect:platformEffectSchema,requester:principal,access:access.nullable()}).strict();
export type TemplateExecutionBinding=z.infer<typeof body>&{bindingDigest:string};
const fail=():never=>{throw Error('platform_template_execution_unavailable')};
function freeze<T>(value:T):Readonly<T>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value)}return value}
export function deriveTemplateRecipient(raw:unknown){return hash({purpose:'platform_template_recipient_v1',...principal.parse(raw)})}
export function templateGrantReference(actionId:string,effectIndex:number){return 'platform_template_grant_'+hash({purpose:'platform_template_grant_v1',actionId:platformActionId.parse(actionId),effectIndex:index.parse(effectIndex)})}
export function nativeTemplateKey(raw:unknown,requester:unknown){const e=platformEffectSchema.parse(raw),p=principal.parse(requester);if(e.kind!=='template.bucket.create'&&e.kind!=='template.object.put'&&e.kind!=='template.access.grant')return fail();const t=e.target;templateRegion(t.region);if(t.bucket!==templateBucketName(t.accountId))return fail();const base={purpose:'platform_template_resource_v1',accountId:t.accountId,bucket:t.bucket,operation:e.kind};if(e.kind==='template.bucket.create')return hash(base);if(e.target.key!==templateObjectKey(e.target.bytesDigest))return fail();return hash({...base,key:e.target.key,...(e.kind==='template.access.grant'?{objectVersion:e.target.objectVersion,userId:p.userId}:{})})}
function validate(raw:unknown){const b=body.parse(raw);nativeTemplateKey(b.effect,b.requester);if(b.effect.kind==='template.bucket.create'){if(b.effect.target.region!=='us-east-2'||b.access!==null)return fail()}else if(b.effect.kind==='template.object.put'){if(b.access!==null)return fail()}else if(b.effect.kind==='template.access.grant'){if(!b.access||b.effect.target.objectVersion==='null'||b.effect.target.recipientDigest!==deriveTemplateRecipient(b.requester)||b.access.grantId!==templateGrantReference(b.actionId,b.effectIndex))return fail()}else return fail();return b}
export function compileTemplateExecutionBinding(raw:unknown):Readonly<TemplateExecutionBinding>{const b=validate(raw);return freeze({...b,bindingDigest:hash(b)})}
export function readTemplateExecutionBinding(raw:unknown):Readonly<TemplateExecutionBinding>{const v=body.extend({bindingDigest:digest}).strict().parse(raw),{bindingDigest,...b}=v;const result=compileTemplateExecutionBinding(b);if(result.bindingDigest!==bindingDigest)return fail();return result}
export type TemplateExecutionReceipt=z.infer<typeof receiptBody>&{receiptDigest:string};
export function createTemplateExecutionReceipt(raw:unknown):Readonly<TemplateExecutionReceipt>{const r=receiptBody.parse(raw),d=r.detail;if(r.outcome==='confirmed'){if(!d||({bucket:'create_bucket',object:'upload',access:'access'}[d.kind])!==r.operation)return fail();if(d.kind==='access'&&(!Number.isSafeInteger(d.signedAt+d.ttlSeconds*1000)||d.hardExpiresAt!==d.signedAt+d.ttlSeconds*1000||d.signedAt%1000!==0||d.signedAt>r.observedAt))return fail()}else if(d!==null)return fail();return freeze({...r,receiptDigest:hash(r)})}
export function readTemplateExecutionReceipt(raw:unknown):Readonly<TemplateExecutionReceipt>{const r=receiptBody.extend({receiptDigest:digest}).strict().parse(raw),{receiptDigest,...body}=r;const result=createTemplateExecutionReceipt(body);if(result.receiptDigest!==receiptDigest)return fail();return result}
