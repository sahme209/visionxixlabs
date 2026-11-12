import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
import {readOperationalEcsResult,type OperationalEcsResult} from './ecsExecution';
import {projectOperationalEcsObservation} from './ecsObservation';
import {readOperationalTarget,type OperationalTarget,type OperationalTargetTransaction} from './reservationContract';
const profileSchema=z.object({profileDigest:digest,expiresAt:z.number().int().positive().safe()}).strict();
interface Ports{
 readProfile(tx:OperationalTargetTransaction,target:OperationalTarget):Promise<unknown>;
 /** A fixed read-only supplier. Evidence is private source possession, never a
  * client-built receipt or caller-supplied green status. No qualified default. */
 describe(target:OperationalTarget,signal:AbortSignal):Promise<{response:unknown;evidence:object}>;
 assertQualified(tx:OperationalTargetTransaction,input:{target:OperationalTarget;accepted:OperationalEcsResult;profile:z.infer<typeof profileSchema>;evidence:object|null}):Promise<void>;
}
const fail=():never=>{throw Error('operational_ecs_observation_unavailable')};
/** Request-scoped source joining the original saved acceptance to one explicit
 * read. No scan for another deployment, polling, write, replay or credentials. */
export function createOperationalEcsOutcomeSource(ports:Ports){
 type Proof={target:OperationalTarget;accepted:OperationalEcsResult;profile:z.infer<typeof profileSchema>;evidence:object|null};
 const proofs=new Map<string,Proof>();
 async function current(tx:OperationalTargetTransaction,p:Proof){
  const saved=readOperationalEcsResult(await tx.readOperationalEcsResult(p.target.actionId)),profile=profileSchema.parse(await ports.readProfile(tx,p.target));
  if(sha256ContentHash(saved)!==sha256ContentHash(p.accepted)||sha256ContentHash(profile)!==sha256ContentHash(p.profile))return fail();await ports.assertQualified(tx,p);const now=await tx.now();if(!Number.isSafeInteger(now)||now<p.target.updatedAt||now>=p.profile.expiresAt)return fail();return now;
 }
 return Object.freeze({async readOutcome(tx:OperationalTargetTransaction,raw:OperationalTarget){try{
  const target=readOperationalTarget(raw),accepted=readOperationalEcsResult(await tx.readOperationalEcsResult(target.actionId));
  if(accepted.kind!=='accepted'||accepted.actionId!==target.actionId||accepted.manifestDigest!==target.manifestDigest||accepted.nativeKey!==target.nativeKey||accepted.generation!==target.generation||target.deploymentId!==null&&target.deploymentId!==accepted.deploymentId||target.phase==='unknown'&&target.deploymentId===null)return fail();
  const profile=profileSchema.parse(await ports.readProfile(tx,target));let proof:Proof={target,accepted,profile,evidence:null};await current(tx,proof);
  let kind:'accepted'|'stable'|'terminal_failure'|'unknown'='accepted';
  if(target.phase!=='reserved'){
   const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   try{const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('unavailable'))},10000)}),observed=await Promise.race([ports.describe(target,abort.signal),timeout]);abort.signal.throwIfAborted();if(!observed.evidence||typeof observed.evidence!=='object')return fail();proof={...proof,evidence:observed.evidence};const projected=projectOperationalEcsObservation(target.target,accepted.deploymentId,observed.response);kind=projected.kind;
   }finally{if(timer)clearTimeout(timer);abort.abort()}
  }
  const now=await current(tx,proof),outcome={receiptId:'platform_evidence_'+randomUUID(),actionId:target.actionId,manifestDigest:target.manifestDigest,target:target.target,generation:target.generation,kind,deploymentId:accepted.deploymentId,observedAt:new Date(now).toISOString(),profileDigest:profile.profileDigest};
  const lineage=sha256ContentHash({nativeKey:target.nativeKey,generation:target.generation,actionId:target.actionId,manifestDigest:target.manifestDigest,snapshotDigest:target.snapshotDigest}),outcomeDigest=sha256ContentHash(outcome);for(const [key,value]of proofs)if(value.profile.expiresAt<=now)proofs.delete(key);if(proofs.size>=64)return fail();proofs.set(sha256ContentHash({lineage,outcomeDigest}),proof);return Object.freeze(outcome);
 }catch{return fail()}},async assertOutcomeCurrent(tx:OperationalTargetTransaction,lineage:string,outcomeDigest:string){try{digest.parse(lineage);digest.parse(outcomeDigest);const proof=proofs.get(sha256ContentHash({lineage,outcomeDigest}));if(!proof)return fail();await current(tx,proof)}catch{return fail()}}});
}
