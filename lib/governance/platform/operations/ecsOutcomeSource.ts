import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
import {assertExecutionWindow,type ExecutionTimeSource,type ExecutionTimeCheck,type ExecutionTimeAuthorization,type ExecutionTimeWindow} from '../executionTime';
import type {OperationalObservationAuthorization} from './observationAuthorization';
import {readOperationalEcsResult,type OperationalEcsResult} from './ecsExecution';
import {projectOperationalEcsObservation} from './ecsObservation';
import {readOperationalTarget,type OperationalTarget,type OperationalTargetTransaction} from './reservationContract';
const stamp=z.number().int().nonnegative().safe();
const profileSchema=z.object({profileDigest:digest,notBefore:stamp,expiresAt:stamp}).strict();
interface Ports{
 clock?:ExecutionTimeSource;
 /** Protected runtime lifetime, not the former reader's request lifetime. */
 signal?:AbortSignal;
 readProfile(tx:OperationalTargetTransaction,target:OperationalTarget):Promise<unknown>;
 /** Fixed read-only supplier must pass beforeRead directly to its final native
  * gate. It requires separate qualified read credentials, never a write handle. */
 describe(target:OperationalTarget,signal:AbortSignal,beforeRead:ExecutionTimeAuthorization):Promise<{response:unknown;evidence:object}>;
 assertQualified(tx:OperationalTargetTransaction,input:{target:OperationalTarget;accepted:OperationalEcsResult;profile:z.infer<typeof profileSchema>;evidence:object|null}):Promise<void>;
}
const fail=():never=>{throw Error('operational_ecs_observation_unavailable')};
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
/** Exact original-acceptance read; no polling, writes or ambient credentials.
 * Later proof validation uses runtime/source authority, never a cached reader. */
export function createOperationalEcsOutcomeSource(ports:Ports){
 const clock=ports.clock,runtime=ports.signal,readProfile=ports.readProfile.bind(ports),qualified=ports.assertQualified.bind(ports),describe=ports.describe.bind(ports);
 type Proof={target:OperationalTarget;accepted:OperationalEcsResult;profile:z.infer<typeof profileSchema>;evidence:object|null};
 const proofs=new Map<string,Proof>();
 function active(scope:AbortSignal,owner?:OperationalObservationAuthorization){scope.throwIfAborted();owner?.assertActive();scope.throwIfAborted()}
 function scopeFor(owner?:OperationalObservationAuthorization){if(typeof clock!=='function'||!(runtime instanceof AbortSignal)||owner&&(!(owner.signal instanceof AbortSignal)||typeof owner.authorize!=='function'||typeof owner.assertActive!=='function'))return fail();return owner?AbortSignal.any([runtime,owner.signal]):runtime}
 async function exact(tx:OperationalTargetTransaction,p:Proof,scope:AbortSignal,owner?:OperationalObservationAuthorization){
  active(scope,owner);const saved=readOperationalEcsResult(await tx.readOperationalEcsResult(p.target.actionId)),profile=profileSchema.parse(await readProfile(tx,p.target));active(scope,owner);
  if(!same(saved,p.accepted)||!same(profile,p.profile)||profile.notBefore>=profile.expiresAt)return fail();await qualified(tx,p);active(scope,owner);
  const after=profileSchema.parse(await readProfile(tx,p.target)),accepted=readOperationalEcsResult(await tx.readOperationalEcsResult(p.target.actionId));active(scope,owner);
  const now=await tx.now();active(scope,owner);if(!same(after,p.profile)||!same(accepted,p.accepted)||!Number.isSafeInteger(now)||now<p.target.updatedAt||now>=p.profile.expiresAt)return fail();return now;
 }
 async function current(tx:OperationalTargetTransaction,p:Proof,owner?:OperationalObservationAuthorization,nativeCheck?:ExecutionTimeCheck){
  const scope=scopeFor(owner);await exact(tx,p,scope,owner);
  const bounds={notBefore:Math.max(p.profile.notBefore,p.target.updatedAt,p.accepted.observedAt),expiresAt:p.profile.expiresAt};
  if(owner){
   let open=true,started=false,complete=false,invalid=false;
   const check:ExecutionTimeCheck=restriction=>{
    const pending=(async()=>{try{
     if(!open||started)return fail();started=true;active(scope,owner);
     const extra:ExecutionTimeWindow=restriction??{},notBefore=extra.notBefore===undefined?bounds.notBefore:Math.max(bounds.notBefore,stamp.parse(extra.notBefore)),expiresAt=extra.expiresAt===undefined?bounds.expiresAt:Math.min(bounds.expiresAt,stamp.parse(extra.expiresAt));
     if(nativeCheck)await nativeCheck({notBefore,expiresAt});else await assertExecutionWindow(clock!,{notBefore,expiresAt},scope);
     active(scope,owner);await exact(tx,p,scope,owner);if(!open)return fail();complete=true;
    }catch{invalid=true;return fail()}})();void pending.catch(()=>{});return pending;
   };
   try{await owner.authorize(check);active(scope,owner);if(!complete||invalid)return fail();return await exact(tx,p,scope,owner)}finally{open=false}
  }
  await assertExecutionWindow(clock!,bounds,scope);active(scope);return exact(tx,p,scope);
 }
 return Object.freeze({async readOutcome(tx:OperationalTargetTransaction,raw:OperationalTarget,owner?:OperationalObservationAuthorization){try{
  if(!owner)return fail();const scope=scopeFor(owner);active(scope,owner);
  const target=readOperationalTarget(raw),accepted=readOperationalEcsResult(await tx.readOperationalEcsResult(target.actionId));active(scope,owner);
  if(accepted.kind!=='accepted'||accepted.actionId!==target.actionId||accepted.manifestDigest!==target.manifestDigest||accepted.nativeKey!==target.nativeKey||accepted.generation!==target.generation||target.deploymentId!==null&&target.deploymentId!==accepted.deploymentId||target.phase==='unknown'&&target.deploymentId===null)return fail();
  const profile=profileSchema.parse(await readProfile(tx,target));let proof:Proof={target,accepted,profile,evidence:null};await current(tx,proof,owner);
  let kind:'accepted'|'stable'|'terminal_failure'|'unknown'='accepted';
  if(target.phase!=='reserved'){
   const abort=new AbortController(),signal=AbortSignal.any([scope,abort.signal]);let timer:ReturnType<typeof setTimeout>|undefined,open=true,started=false,complete=false,invalid=false;
   const beforeRead:ExecutionTimeAuthorization=nativeCheck=>{
    const pending=(async()=>{try{if(!open||started||typeof nativeCheck!=='function')return fail();started=true;active(signal,owner);await current(tx,proof,owner,nativeCheck);active(signal,owner);if(!open)return fail();complete=true}catch{invalid=true;return fail()}})();void pending.catch(()=>{});return pending;
   };
   try{
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('unavailable'))},10000)}),observed=await Promise.race([describe(target,signal,beforeRead),timeout]);active(signal,owner);
    if(!complete||invalid||!observed.evidence||typeof observed.evidence!=='object')return fail();proof={...proof,evidence:observed.evidence};kind=projectOperationalEcsObservation(target.target,accepted.deploymentId,observed.response).kind;
   }finally{open=false;if(timer)clearTimeout(timer);abort.abort()}
  }
  const now=await current(tx,proof,owner),outcome={receiptId:'platform_evidence_'+randomUUID(),actionId:target.actionId,manifestDigest:target.manifestDigest,target:target.target,generation:target.generation,kind,deploymentId:accepted.deploymentId,observedAt:new Date(now).toISOString(),profileDigest:profile.profileDigest};
  const lineage=sha256ContentHash({nativeKey:target.nativeKey,generation:target.generation,actionId:target.actionId,manifestDigest:target.manifestDigest,snapshotDigest:target.snapshotDigest}),outcomeDigest=sha256ContentHash(outcome);for(const [key,value]of proofs)if(value.profile.expiresAt<=now)proofs.delete(key);if(proofs.size>=64)return fail();proofs.set(sha256ContentHash({lineage,outcomeDigest}),proof);return Object.freeze(outcome);
 }catch{return fail()}},async assertOutcomeCurrent(tx:OperationalTargetTransaction,lineage:string,outcomeDigest:string,owner?:OperationalObservationAuthorization){try{digest.parse(lineage);digest.parse(outcomeDigest);const proof=proofs.get(sha256ContentHash({lineage,outcomeDigest}));if(!proof)return fail();await current(tx,proof,owner)}catch{return fail()}}});
}
