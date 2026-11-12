import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
import {operationalEcsTarget,operationalEvidenceId} from './contracts';
import {operationalWorkloadBinding} from './workloadIdentity';
import type {OperationalDelegation} from './delegationContract';
const stamp=z.string().max(40).datetime(),clock=z.number().int().nonnegative().safe(),deploymentId=z.string().regex(/^[A-Za-z0-9_-]{1,128}(?:\/[A-Za-z0-9_-]{1,128})?$/);
export type OperationalTargetBinding=Pick<OperationalDelegation,'actionId'|'manifest'>;
export const operationalTargetReference=z.object({nativeKey:digest,generation:z.number().int().positive().safe()}).strict();
export function nativeEcsTargetKey(raw:unknown){const target=operationalEcsTarget.parse(raw),cluster=target.clusterArn.split(':cluster/')[1],service=target.serviceArn.split(':service/')[1].split('/').at(-1)!;return sha256ContentHash({kind:'axiom_operational_ecs_target_v1',accountId:target.accountId,region:target.region,cluster,service})}
export const operationalNativeSnapshot=z.object({receiptId:operationalEvidenceId,target:operationalEcsTarget,deploymentId,observedAt:stamp,expiresAt:stamp,profileDigest:digest}).strict();
export const operationalNativeOutcome=z.object({receiptId:operationalEvidenceId,actionId:operationalWorkloadBinding.shape.actionId,manifestDigest:digest,target:operationalEcsTarget,generation:z.number().int().positive().safe(),kind:z.enum(['accepted','stable','terminal_failure','unknown']),deploymentId:deploymentId.nullable(),observedAt:stamp,profileDigest:digest}).strict().refine(v=>v.kind==='unknown'||v.deploymentId!==null);
const targetSchema=z.object({nativeKey:digest,actionId:operationalWorkloadBinding.shape.actionId,manifestDigest:digest,target:operationalEcsTarget,generation:z.number().int().positive().safe(),version:clock,phase:z.enum(['reserved','accepted','stable','terminal_failure','unknown']),deploymentId:deploymentId.nullable(),priorTaskDefinitionArn:z.string(),priorDeploymentId:deploymentId,priorDeploymentReceiptId:operationalEvidenceId,lastReceiptId:operationalEvidenceId,snapshotDigest:digest,bindingDigest:digest,sourceExpiresAt:stamp,previousCredentialClosureReceiptId:operationalEvidenceId.nullable(),createdAt:clock,updatedAt:clock}).strict();
const fail=():never=>{throw Error('operational_target_unavailable')};
export function readOperationalTarget(raw:unknown){const value=targetSchema.parse(raw);if(value.nativeKey!==nativeEcsTargetKey(value.target)||value.updatedAt<value.createdAt||value.createdAt>=Date.parse(value.sourceExpiresAt)||value.phase==='reserved'&&value.deploymentId!==null||['accepted','stable','terminal_failure'].includes(value.phase)&&value.deploymentId===null)return fail();operationalEcsTarget.parse({...value.target,taskDefinitionArn:value.priorTaskDefinitionArn});return Object.freeze(value)}
const receiptSchema=z.object({receiptId:operationalEvidenceId,nativeKey:digest,generation:z.number().int().positive().safe(),actionId:operationalWorkloadBinding.shape.actionId,manifestDigest:digest,kind:z.enum(['snapshot','accepted','stable','terminal_failure','unknown']),previousCredentialClosureReceiptId:operationalEvidenceId.nullable(),detail:z.unknown(),receiptDigest:digest}).strict();
export function readOperationalTargetReceipt(raw:unknown){const value=receiptSchema.parse(raw),detail=value.kind==='snapshot'?operationalNativeSnapshot.parse(value.detail):operationalNativeOutcome.parse(value.detail),{receiptDigest,...body}=value;if(value.receiptId!==detail.receiptId||value.nativeKey!==nativeEcsTargetKey(detail.target)||receiptDigest!==sha256ContentHash({...body,detail}))return fail();if('kind' in detail&&(detail.kind!==value.kind||detail.actionId!==value.actionId||detail.manifestDigest!==value.manifestDigest||detail.generation!==value.generation))return fail();return Object.freeze({...value,detail})}
export type OperationalTarget=ReturnType<typeof readOperationalTarget>;
export type OperationalTargetReceipt=ReturnType<typeof readOperationalTargetReceipt>;
export interface OperationalTargetTransaction{
 readOperationalEcsResult(actionId:string):Promise<unknown>;
 readOperationalCredentialLiability(actionId:string):Promise<unknown>;
 now():Promise<number>;lockOperationalTarget(nativeKey:string):Promise<void>;
 readOperationalTarget(nativeKey:string):Promise<unknown|null>;
 insertOperationalTarget(nativeKey:string,state:OperationalTarget):Promise<void>;
 replaceOperationalTarget(nativeKey:string,version:number,state:OperationalTarget):Promise<void>;
 readOperationalTargetReceipt(receiptId:string):Promise<unknown|null>;
 insertOperationalTargetReceipt(receipt:OperationalTargetReceipt):Promise<void>;
}
