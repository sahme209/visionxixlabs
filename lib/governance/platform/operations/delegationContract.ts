import {z} from 'zod';
import {digest,platformPrincipalSchema} from '../contracts';
import type {PlatformTransaction} from '../actionStore';
import {operationalWorkloadReference} from './contracts';
import {operationalWorkloadBinding,type OperationalWorkloadTransaction} from './workloadIdentity';
import {readOperationalManifest} from './kernel';
const clock=z.number().int().nonnegative().safe();
export const credentialOutcome=z.discriminatedUnion('status',[
 z.object({status:z.literal('issued'),leaseRef:z.string().regex(/^platform_credential_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),expiresAt:clock}).strict(),
 z.object({status:z.literal('unknown')}).strict(),
]);
const credential=z.discriminatedUnion('status',[
 z.object({status:z.literal('not_requested')}).strict(),
 z.object({status:z.literal('pending'),requestedAt:clock}).strict(),
 z.object({status:z.literal('issued'),requestedAt:clock,observedAt:clock,leaseRef:z.string().regex(/^platform_credential_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),expiresAt:clock}).strict(),
 z.object({status:z.literal('unknown'),requestedAt:clock,observedAt:clock}).strict(),
]);
const executionPrincipal=z.object({kind:z.literal('workload'),workload:operationalWorkloadReference,profileDigest:digest,replayKey:digest,expiresAt:clock}).strict();
const recordSchema=z.object({actionId:operationalWorkloadBinding.shape.actionId,parentPlanDigest:digest,manifest:z.unknown(),requester:platformPrincipalSchema,reviewer:platformPrincipalSchema,status:z.enum(['delegated','claimed']),version:z.number().int().min(0).max(3),attemptCount:z.number().int().min(0).max(1),executionPrincipal:executionPrincipal.nullable(),credential,createdAt:clock,updatedAt:clock}).strict();
const fail=():never=>{throw Error('operational_delegation_unavailable')};
export function readOperationalDelegation(raw:unknown){
 const value=recordSchema.parse(raw),manifest=readOperationalManifest(value.manifest);
 if(manifest.kind!=='deployment.ecs')return fail();
 if(value.requester.userId===value.reviewer.userId||value.updatedAt<value.createdAt||value.createdAt>=Date.parse(manifest.expiresAt))return fail();
 if(value.status==='delegated'){
  if(value.version!==0||value.attemptCount!==0||value.executionPrincipal!==null||value.credential.status!=='not_requested')return fail();
 }else{
  const principal=value.executionPrincipal;if(!principal||value.attemptCount!==1||principal.expiresAt<=value.createdAt||principal.expiresAt>Date.parse(manifest.expiresAt)||JSON.stringify(principal.workload)!==JSON.stringify(manifest.workload))return fail();
  if(value.version!==(value.credential.status==='not_requested'?1:value.credential.status==='pending'?2:3))return fail();
 }
 if(value.credential.status!=='not_requested'&&(value.credential.requestedAt<value.createdAt||value.credential.requestedAt>value.updatedAt))return fail();
 if((value.credential.status==='issued'||value.credential.status==='unknown')&&(value.credential.observedAt<value.credential.requestedAt||value.credential.observedAt>value.updatedAt))return fail();
 if(value.credential.status==='issued'&&value.credential.expiresAt<=value.credential.requestedAt)return fail();
 return Object.freeze({...value,manifest});
}
export type OperationalDelegation=ReturnType<typeof readOperationalDelegation>;
export interface OperationalDelegationTransaction extends PlatformTransaction,OperationalWorkloadTransaction{
 readDelegation(actionId:string):Promise<unknown|null>;
 insertDelegation(actionId:string,state:OperationalDelegation):Promise<void>;
 replaceDelegation(actionId:string,version:number,state:OperationalDelegation):Promise<void>;
}
export interface OperationalDelegationRepository{transaction<T>(fn:(tx:OperationalDelegationTransaction)=>Promise<T>):Promise<T>}
