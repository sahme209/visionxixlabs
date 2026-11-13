import 'server-only';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {readPlatformTemplateBytes} from '@/lib/cloud/aws/platformTemplateSource';
import {templateBucketEffect,templateObjectEffect,templateAccessEffect} from '@/lib/cloud/aws/platformTemplatePlan';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {platformPrincipalSchema,digest} from './contracts';
import {compilePlatformPlan} from './kernel';
import {deriveTemplateRecipient,templateGrantReference,compileTemplateExecutionBinding,readTemplateExecutionBinding} from './templateExecutionContract';
import {templateWorkflowSelection as templateExecutionSelection,templateSelectionBase as base} from './templateWorkflowContract';
export {templateWorkflowSelection as templateExecutionSelection} from './templateWorkflowContract';
export const templateExecutionProfile=z.object({accountId:base.accountId,region:base.region,profileDigest:digest,access:z.object({artifactProfileDigest:digest,clockSkewMs:z.number().int().min(1).max(30000)}).strict().nullable()}).strict();
export type TemplateExecutionSelection=z.infer<typeof templateExecutionSelection>;
export type TemplateExecutionProfile=z.infer<typeof templateExecutionProfile>;
const fail=():never=>{throw Error('platform_template_preparation_unavailable')};
/** Fixed local source and private profile metadata only. This does not qualify
 * native ownership/version presence, credentials, clocks, keys or channels. */
export async function prepareTemplateExecutionPlan(raw:unknown,now:number,actionId:string,rawPrincipal:unknown,rawProfile:unknown){const selection=templateExecutionSelection.parse(raw),requester=platformPrincipalSchema.parse(rawPrincipal),profile=templateExecutionProfile.parse(rawProfile);if(!Number.isSafeInteger(now)||now<0||Date.parse(selection.expiresAt)<=now||profile.accountId!==selection.accountId||profile.region!==selection.region)return fail();let effect;
 if(selection.operation==='create_bucket'){if(selection.region!=='us-east-2')return fail();effect=templateBucketEffect(selection.accountId,selection.region)}else{const bytes=await readPlatformTemplateBytes(),bytesDigest=createHash('sha256').update(bytes).digest('hex');effect=selection.operation==='upload'?templateObjectEffect(selection.accountId,selection.region,bytesDigest):templateAccessEffect({...selection,bytesDigest,recipientDigest:deriveTemplateRecipient(requester)})}
 const access=selection.operation==='access'?profile.access?{delivery:'original_requester_session' as const,grantId:templateGrantReference(actionId,0),...profile.access}:fail():null;
 const sourceDigest=hash({purpose:'platform_template_execution_source_v1',effect,requester,profileDigest:profile.profileDigest,access});const plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest,expiresAt:selection.expiresAt,effects:[effect]});
 const binding=compileTemplateExecutionBinding({format:1,purpose:'platform_template_execution_binding_v1',actionId,effectIndex:0,planDigest:plan.digest,sourceDigest,profileDigest:profile.profileDigest,approvalExpiresAt:plan.expiresAt,effect,requester,access});return {plan,binding};
}
export function templateSelectionFromBinding(raw:unknown){const b=readTemplateExecutionBinding(raw),e=b.effect;if(e.kind!=='template.bucket.create'&&e.kind!=='template.object.put'&&e.kind!=='template.access.grant')return fail();return templateExecutionSelection.parse({operation:e.kind==='template.bucket.create'?'create_bucket':e.kind==='template.object.put'?'upload':'access',accountId:e.target.accountId,region:e.target.region,expiresAt:b.approvalExpiresAt,...(e.kind==='template.access.grant'?{objectVersion:e.target.objectVersion,ttlSeconds:e.target.ttlSeconds,delivery:'original_requester_session'}:{})})}
/** Recovery compares original requested metadata; it never rereads current file,
 * profiles, expiry or role evidence to manufacture replacement permission. */
export function matchesTemplateExecutionSelection(binding:unknown,raw:unknown){try{return hash(templateSelectionFromBinding(binding))===hash(templateExecutionSelection.parse(raw))}catch{return false}}
