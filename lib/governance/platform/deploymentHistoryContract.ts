import {z} from 'zod';
import {digest} from './contracts';
import {platformActionId,platformInspectionSchema} from './viewContract';
/** Nonsecret request acceptance history. No serving URL, credential, current
 * reservation availability or READY assertion is part of this data contract. */
export const deploymentRequestReceiptView=z.object({format:z.literal(1),purpose:z.literal('platform_deployment_request_receipt_v1'),receiptId:z.string().regex(/^platform_deployment_receipt_[a-f0-9-]{36}$/),nativeKey:digest,generation:z.number().int().positive().safe(),actionId:platformActionId,effectIndex:z.number().int().min(0).max(31),planDigest:digest,sourceDigest:digest,providerDeploymentId:z.string().max(256).regex(/^dpl_[A-Za-z0-9]+$/).nullable(),providerState:z.string().regex(/^[A-Z_]{1,64}$/).nullable(),outcome:z.enum(['accepted','refused','unknown']),observedAt:z.number().int().nonnegative().safe(),ready:z.literal(false),receiptDigest:digest}).strict().refine(v=>v.outcome==='accepted'?v.providerDeploymentId!==null&&v.providerState!==null:v.providerDeploymentId===null&&v.providerState===null);
export const deploymentHistoryView=z.object({action:platformInspectionSchema,requests:z.array(deploymentRequestReceiptView).max(32),authority:z.literal('deployment_history_only'),sourceValidation:z.literal('not_checked'),currentTargetChecked:z.literal(false),deploymentReadyChecked:z.literal(false),executionAuthorized:z.literal(false)}).strict().refine(v=>{
 if(v.action.plan.effects.some(e=>e.kind!=='deployment.vercel')||new Set(v.requests.map(r=>r.effectIndex)).size!==v.requests.length||new Set(v.requests.map(r=>r.receiptId)).size!==v.requests.length)return false;
 return v.requests.every(r=>r.actionId===v.action.actionId&&r.planDigest===v.action.plan.digest&&r.sourceDigest===v.action.plan.sourceDigest&&v.action.plan.effects[r.effectIndex]?.kind==='deployment.vercel'&&v.action.effects[r.effectIndex]?.status===(r.outcome==='accepted'?'confirmed':r.outcome));
});
export type DeploymentHistoryView=z.infer<typeof deploymentHistoryView>;
