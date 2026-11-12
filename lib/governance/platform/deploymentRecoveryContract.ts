import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from './contracts';
import {compilePlatformPlan} from './kernel';
import {platformActionId} from './viewContract';
import {deploymentReservationSchema,readDeploymentReservation,readDeploymentRequestReceipt,deploymentTerminalObservationSchema,releaseDeploymentTarget} from './deploymentLiability';
const fail=():never=>{throw Error('platform_deployment_recovery_unavailable')};
const positive=z.number().int().positive().safe(),stamp=z.number().int().nonnegative().safe();
const body=z.object({format:z.literal(1),purpose:z.literal('platform_deployment_recovery_plan_v1'),nativeKey:digest,target:deploymentReservationSchema.shape.target,originalActionId:platformActionId,effectIndex:z.number().int().min(0).max(31),originalPlanDigest:digest,originalSourceDigest:digest,requestReceiptId:z.string().regex(/^platform_deployment_receipt_[a-f0-9-]{36}$/),requestReceiptDigest:digest,generation:positive,expectedReservationVersion:stamp,providerDeploymentId:z.string().max(256).regex(/^dpl_[A-Za-z0-9]+$/),profileDigest:digest,expiresAt:z.string().datetime()}).strict();
const preparation=z.object({reservation:z.unknown(),receipt:z.unknown(),profileDigest:digest,expiresAt:z.string().datetime()}).strict();
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v)}return v}
function wrap(raw:z.infer<typeof body>){const value=body.parse(raw);if(value.nativeKey!==sha256ContentHash({purpose:'platform_vercel_target_v1',...value.target}))return fail();return freeze({...value,digest:sha256ContentHash(value),authority:'metadata_only' as const,executionAuthorized:false as const})}
export type DeploymentRecoveryPlan=ReturnType<typeof wrap>;
/** Exact review metadata only. Neither a hash nor a terminal status supplied by
 * a caller qualifies the provider, the original humans or a release. */
export function compileDeploymentRecoveryPlan(raw:unknown):DeploymentRecoveryPlan{try{
 const input=preparation.parse(raw),r=readDeploymentReservation(input.reservation),receipt=readDeploymentRequestReceipt(input.receipt);
 if(r.phase!=='held'||receipt.outcome!=='accepted'||!receipt.providerDeploymentId||r.requestReceiptDigest!==receipt.receiptDigest||r.actionId!==receipt.actionId||r.nativeKey!==receipt.nativeKey||r.generation!==receipt.generation||r.effectIndex!==receipt.effectIndex||r.planDigest!==receipt.planDigest||r.sourceDigest!==receipt.sourceDigest||receipt.observedAt<r.createdAt||receipt.observedAt>r.updatedAt||Date.parse(input.expiresAt)<=r.updatedAt)return fail();
 return wrap({format:1,purpose:'platform_deployment_recovery_plan_v1',nativeKey:r.nativeKey,target:r.target,originalActionId:r.actionId,effectIndex:r.effectIndex,originalPlanDigest:r.planDigest,originalSourceDigest:r.sourceDigest,requestReceiptId:receipt.receiptId,requestReceiptDigest:receipt.receiptDigest,generation:r.generation,expectedReservationVersion:r.version,providerDeploymentId:receipt.providerDeploymentId,profileDigest:input.profileDigest,expiresAt:input.expiresAt});
}catch{return fail()}}
export function readDeploymentRecoveryPlan(raw:unknown):DeploymentRecoveryPlan{try{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail();const {digest:hash,authority,executionAuthorized,...fields}=raw as Record<string,unknown>,expected=wrap(body.parse(fields));
 if(hash!==expected.digest||authority!=='metadata_only'||executionAuthorized!==false)return fail();return expected;
}catch{return fail()}}
export function compileDeploymentRecoveryPlatformPlan(raw:unknown){const p=readDeploymentRecoveryPlan(raw);return compilePlatformPlan({format:1,scope:'platform',sourceDigest:p.digest,expiresAt:p.expiresAt,effects:[{id:'release-deployment-target',kind:'deployment.target.release',target:{nativeKey:p.nativeKey,generation:p.generation,expectedReservationVersion:p.expectedReservationVersion,originalActionId:p.originalActionId,requestReceiptDigest:p.requestReceiptDigest,providerDeploymentId:p.providerDeploymentId,profileDigest:p.profileDigest,recoveryDigest:p.digest}}]})}
/** Pure comparison after a PRIVATE native supplier has qualified evidence.
 * The future store must repeat current authority around its atomic CAS; this
 * function is deliberately not exposed as an execution endpoint or proof. */
export function validateDeploymentRecoveryEvidence(rawPlan:unknown,rawReservation:unknown,rawReceipt:unknown,rawEvidence:unknown,now:number){try{
 const p=readDeploymentRecoveryPlan(rawPlan),r=readDeploymentReservation(rawReservation),receipt=readDeploymentRequestReceipt(rawReceipt),e=deploymentTerminalObservationSchema.parse(rawEvidence);
 if(compileDeploymentRecoveryPlan({reservation:r,receipt,profileDigest:p.profileDigest,expiresAt:p.expiresAt}).digest!==p.digest||e.profileDigest!==p.profileDigest||now>=Date.parse(p.expiresAt))return fail();
 return releaseDeploymentTarget(r,receipt,e,now);
}catch{return fail()}}
