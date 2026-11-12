import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
import {operationalWorkloadBinding} from './workloadIdentity';
import type {OperationalDelegation} from './delegationContract';
export interface OperationalEcsTransport{
 assertQualified(tx:import('./delegationContract').OperationalDelegationTransaction,manifest:OperationalDelegation['manifest']):Promise<void>;
 /** Fixed private transport only. Must honor abort and call beforeSend directly
  * before exactly one update. No automatic waiter, retry or rollback. */
 send(manifest:OperationalDelegation['manifest'],credentials:Readonly<{accessKeyId:string;secretAccessKey:string;sessionToken:string;expiresAt:number}>,beforeSend:()=>Promise<void>,signal:AbortSignal):Promise<unknown>;
}
const body=z.object({format:z.literal(1),purpose:z.literal('operational_ecs_update_result_v1'),actionId:operationalWorkloadBinding.shape.actionId,manifestDigest:digest,nativeKey:digest,generation:z.number().int().positive().safe(),leaseRef:z.string().regex(/^platform_credential_[a-f0-9-]{36}$/),kind:z.enum(['accepted','unknown']),deploymentId:z.string().regex(/^ecs-svc\/[0-9]{1,32}$/).nullable(),requestId:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).nullable(),observedAt:z.number().int().nonnegative().safe(),stable:z.literal(false),rollbackAuthorized:z.literal(false)}).strict();
const schema=body.extend({receiptDigest:digest}).strict();
export function readOperationalEcsResult(raw:unknown){const value=schema.parse(raw),{receiptDigest,...fields}=value;if(receiptDigest!==sha256ContentHash(fields)||value.kind==='accepted'&&(value.deploymentId===null||value.requestId===null)||value.kind==='unknown'&&(value.deploymentId!==null||value.requestId!==null))throw Error('operational_ecs_result_unavailable');return Object.freeze(value)}
export type OperationalEcsResult=ReturnType<typeof readOperationalEcsResult>;
/** Nonsecret immutable metadata only; digest is not an issuer attestation. */
export function createOperationalEcsResult(raw:z.input<typeof body>){const fields=body.parse(raw);return readOperationalEcsResult({...fields,receiptDigest:sha256ContentHash(fields)})}
