import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {operationalEcsResultBody as body,operationalEcsResultSchema as schema} from './ecsResultContract';
import type {OperationalDelegation} from './delegationContract';
export interface OperationalEcsTransport{
 assertQualified(tx:import('./delegationContract').OperationalDelegationTransaction,manifest:OperationalDelegation['manifest']):Promise<void>;
 /** Fixed private transport only. Must honor abort and call beforeSend directly
  * before exactly one update. No automatic waiter, retry or rollback. */
 send(manifest:OperationalDelegation['manifest'],credentials:Readonly<{accessKeyId:string;secretAccessKey:string;sessionToken:string;expiresAt:number}>,beforeSend:()=>Promise<void>,signal:AbortSignal):Promise<unknown>;
}
export function readOperationalEcsResult(raw:unknown){const value=schema.parse(raw),{receiptDigest,...fields}=value;if(receiptDigest!==sha256ContentHash(fields)||value.kind==='accepted'&&(value.deploymentId===null||value.requestId===null)||value.kind==='unknown'&&(value.deploymentId!==null||value.requestId!==null))throw Error('operational_ecs_result_unavailable');return Object.freeze(value)}
export type OperationalEcsResult=ReturnType<typeof readOperationalEcsResult>;
/** Nonsecret immutable metadata only; digest is not an issuer attestation. */
export function createOperationalEcsResult(raw:z.input<typeof body>){const fields=body.parse(raw);return readOperationalEcsResult({...fields,receiptDigest:sha256ContentHash(fields)})}
