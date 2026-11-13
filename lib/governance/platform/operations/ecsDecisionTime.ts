import 'server-only';
import {z} from 'zod';
import {digest} from '../contracts';
import type {PlatformPrincipal} from '../contracts';
import type {PlatformTransaction} from '../actionStore';
import {assertPlatformParticipantsTime} from '../principalTime';
import type {ExecutionTimeSource} from '../executionTime';
import type {EcsManifest} from './ecsPreparation';
import {operationalEvidenceId} from './contracts';
export interface EcsDecisionTiming{clock:ExecutionTimeSource;signal?:AbortSignal}
export interface EcsDecisionTimeSource{
 /** Exact private source/profile evidence, never supplied by request JSON.
  * Structural matches do not establish native clock/profile provenance. */
 readTimeWindow?(tx:PlatformTransaction,manifest:EcsManifest):Promise<unknown>;
}
const stamp=z.number().int().nonnegative().safe();
const window=z.object({manifestDigest:digest,sourceEvidenceId:operationalEvidenceId,profileDigest:digest,notBefore:stamp,expiresAt:stamp}).strict();
const fail=():never=>{throw Error('ecs_decision_time_unavailable')};
/** Supplemental validation inside the original decision transaction. The owner
 * retains source/role/DB-order checks and repeats them after this await. */
export function createEcsDecisionTime(source:EcsDecisionTimeSource,timing?:EcsDecisionTiming){
 const read=source.readTimeWindow?.bind(source),clock=timing?.clock,signal=timing?.signal;
 return async<T>(tx:PlatformTransaction,people:readonly PlatformPrincipal[],manifest:EcsManifest,notBefore:number,afterTime:()=>Promise<T>):Promise<T>=>{
  try{
   if(typeof read!=='function'||typeof clock!=='function'||!(signal instanceof AbortSignal))return fail();signal.throwIfAborted();
   const before=window.parse(await read(tx,manifest));signal.throwIfAborted();
   if(before.manifestDigest!==manifest.digest||before.sourceEvidenceId!==manifest.sourceEvidenceId||before.notBefore>=before.expiresAt)return fail();
   await assertPlatformParticipantsTime(tx,people,clock,{notBefore:Math.max(stamp.parse(notBefore),before.notBefore),expiresAt:Math.min(Date.parse(manifest.expiresAt),before.expiresAt)},signal);signal.throwIfAborted();
   const value=await afterTime();signal.throwIfAborted();
   const after=window.parse(await read(tx,manifest));signal.throwIfAborted();
   if(after.manifestDigest!==before.manifestDigest||after.sourceEvidenceId!==before.sourceEvidenceId||after.profileDigest!==before.profileDigest||after.notBefore!==before.notBefore||after.expiresAt!==before.expiresAt)return fail();return value;
  }catch{return fail()}
 };
}
