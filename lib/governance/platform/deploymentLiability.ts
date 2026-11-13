import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest,platformEffectSchema,type PlatformEffect} from './contracts';
import {platformActionId} from './viewContract';
const stamp=z.number().int().nonnegative().safe(),positive=z.number().int().positive().safe();
const target=z.object({provider:z.literal('vercel'),teamId:z.string().min(1).max(256),projectName:z.string().min(1).max(256),environment:z.enum(['production','preview'])}).strict().readonly();
export const deploymentReservationSchema=z.object({format:z.literal(1),nativeKey:digest,target,actionId:platformActionId,effectIndex:z.number().int().min(0).max(31),planDigest:digest,sourceDigest:digest,generation:positive,version:stamp,phase:z.enum(['held','released']),createdAt:stamp,updatedAt:stamp,requestReceiptDigest:digest.nullable(),releaseObservationDigest:digest.nullable()}).strict().refine(v=>v.updatedAt>=v.createdAt&&(v.phase==='released'?v.requestReceiptDigest!==null&&v.releaseObservationDigest!==null:v.releaseObservationDigest===null));
export type DeploymentReservation=z.infer<typeof deploymentReservationSchema>;
const requestBody=z.object({format:z.literal(1),purpose:z.literal('platform_deployment_request_receipt_v1'),receiptId:z.string().regex(/^platform_deployment_receipt_[a-f0-9-]{36}$/),nativeKey:digest,generation:positive,actionId:platformActionId,effectIndex:z.number().int().min(0).max(31),planDigest:digest,sourceDigest:digest,providerDeploymentId:z.string().max(256).regex(/^dpl_[A-Za-z0-9]+$/).nullable(),providerState:z.string().regex(/^[A-Z_]{1,64}$/).nullable(),outcome:z.enum(['accepted','refused','unknown']),observedAt:stamp,ready:z.literal(false)}).strict();
export const deploymentRequestReceiptSchema=requestBody.extend({receiptDigest:digest}).strict();
export type DeploymentRequestReceipt=z.infer<typeof deploymentRequestReceiptSchema>;
export const deploymentTerminalObservationSchema=z.object({format:z.literal(1),purpose:z.literal('platform_deployment_terminal_observation_v1'),observationId:z.string().regex(/^platform_evidence_[a-f0-9-]{36}$/),nativeKey:digest,generation:positive,actionId:platformActionId,requestReceiptDigest:digest,providerDeploymentId:z.string().max(256).regex(/^dpl_[A-Za-z0-9]+$/),profileDigest:digest,kind:z.literal('terminal_safe_to_release'),observedAt:stamp,expiresAt:stamp}).strict();
export type DeploymentTerminalObservation=z.infer<typeof deploymentTerminalObservationSchema>;
const fail=():never=>{throw Error('platform_deployment_liability_unavailable')};
function readReservation(raw:unknown){const v=deploymentReservationSchema.parse(raw);if(v.nativeKey!==sha256ContentHash({purpose:'platform_vercel_target_v1',...v.target}))return fail();return Object.freeze(v)}
function effectTarget(raw:PlatformEffect){const e=platformEffectSchema.parse(raw);if(e.kind!=='deployment.vercel')return fail();return target.parse({provider:'vercel',teamId:e.target.teamId,projectName:e.target.projectName,environment:e.target.environment})}
export function nativeDeploymentKey(effect:PlatformEffect){try{return sha256ContentHash({purpose:'platform_vercel_target_v1',...effectTarget(effect)})}catch{return fail()}}
/** Pure proposed-state transition. Only the locked current-authority store may
 * persist/admit it. A key/hash is metadata, never a send or release capability. */
export function reserveDeploymentTarget(effect:PlatformEffect,actionId:string,effectIndex:number,planDigest:string,sourceDigest:string,now:number,previous:unknown):Readonly<DeploymentReservation>{try{
 stamp.parse(now);const selected=effectTarget(effect),key=nativeDeploymentKey(effect),old=previous===null?null:readReservation(previous);
 if(old&&(old.nativeKey!==key||old.phase!=='released'||now<old.updatedAt||old.actionId===actionId))return fail();
 return readReservation({format:1,nativeKey:key,target:selected,actionId,effectIndex,planDigest,sourceDigest,generation:old?old.generation+1:1,version:old?old.version+1:0,phase:'held',createdAt:now,updatedAt:now,requestReceiptDigest:null,releaseObservationDigest:null});
}catch{return fail()}}
export function createDeploymentRequestReceipt(raw:unknown):Readonly<DeploymentRequestReceipt>{try{const fields=requestBody.parse(raw);return readDeploymentRequestReceipt({...fields,receiptDigest:sha256ContentHash(fields)})}catch{return fail()}}
export function readDeploymentRequestReceipt(raw:unknown):Readonly<DeploymentRequestReceipt>{try{const value=deploymentRequestReceiptSchema.parse(raw),{receiptDigest,...fields}=value;if(receiptDigest!==sha256ContentHash(fields)||(value.outcome==='accepted'?(value.providerDeploymentId===null||value.providerState===null):(value.providerDeploymentId!==null||value.providerState!==null)))return fail();return Object.freeze(value)}catch{return fail()}}
export function observeDeploymentRequest(rawReservation:unknown,rawReceipt:unknown,now:number):Readonly<DeploymentReservation>{try{
 const r=readReservation(rawReservation),v=readDeploymentRequestReceipt(rawReceipt);stamp.parse(now);
 if(r.phase!=='held'||r.requestReceiptDigest!==null||v.nativeKey!==r.nativeKey||v.generation!==r.generation||v.actionId!==r.actionId||v.effectIndex!==r.effectIndex||v.planDigest!==r.planDigest||v.sourceDigest!==r.sourceDigest||v.observedAt<r.createdAt||v.observedAt>now||now<r.updatedAt)return fail();
 return readReservation({...r,version:r.version+1,updatedAt:now,requestReceiptDigest:v.receiptDigest});
}catch{return fail()}}
/** The caller MUST independently qualify native terminal evidence and genuine
 * exact review/current authority. This pure validator supplies no such proof. */
export function releaseDeploymentTarget(rawReservation:unknown,rawReceipt:unknown,rawObservation:unknown,now:number):Readonly<DeploymentReservation>{try{
 const r=readReservation(rawReservation),receipt=readDeploymentRequestReceipt(rawReceipt),o=deploymentTerminalObservationSchema.parse(rawObservation);stamp.parse(now);
 if(r.phase!=='held'||r.requestReceiptDigest===null||r.requestReceiptDigest!==receipt.receiptDigest||receipt.outcome!=='accepted'||o.nativeKey!==r.nativeKey||o.generation!==r.generation||o.actionId!==r.actionId||o.requestReceiptDigest!==receipt.receiptDigest||o.providerDeploymentId!==receipt.providerDeploymentId||o.observedAt<receipt.observedAt||o.observedAt>now||o.expiresAt<=now||now<r.updatedAt)return fail();
 if(receipt.nativeKey!==r.nativeKey||receipt.actionId!==r.actionId||receipt.generation!==r.generation||receipt.planDigest!==r.planDigest||receipt.sourceDigest!==r.sourceDigest||receipt.effectIndex!==r.effectIndex)return fail();
 return readReservation({...r,version:r.version+1,phase:'released',updatedAt:now,releaseObservationDigest:sha256ContentHash(o)});
}catch{return fail()}}
export function readDeploymentReservation(raw:unknown):Readonly<DeploymentReservation>{try{return readReservation(raw)}catch{return fail()}}

export const deploymentSendObservationSchema=z.object({kind:z.literal('deployment.request'),providerDeploymentId:z.string().max(256).regex(/^dpl_[A-Za-z0-9]+$/),providerState:z.string().regex(/^[A-Z_]{1,64}$/)}).strict();
