import 'server-only';
import type {PlatformSql} from './sqlRepository';
import type {DeploymentRecoveryTransaction} from './deploymentRecoveryStore';
import type {PlatformTransaction} from './actionStore';
import {readPlatformAction} from './kernel';
import {readDeploymentRecoveryPlan,compileDeploymentRecoveryPlatformPlan,validateDeploymentRecoveryEvidence} from './deploymentRecoveryContract';
import {readDeploymentRequestReceipt,readDeploymentReservation,nativeDeploymentKey,deploymentTerminalObservationSchema} from './deploymentLiability';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const fail=():never=>{throw Error('platform_deployment_recovery_storage_unavailable')};
type Methods=Pick<DeploymentRecoveryTransaction,'readDeploymentRecoveryReceipt'|'readDeploymentRecoveryPlan'|'readDeploymentReleaseObservation'|'releaseDeploymentReservation'>;
/** Reuses append-only events and existing target/receipt tables. Target reads
 * enforce the same target-wide advisory lock used by native send admission. */
export function createDeploymentRecoverySql(sql:PlatformSql,get:()=>DeploymentRecoveryTransaction,check:(id:string)=>void,currentAction:()=>string|null):Methods {
 return {
  async readDeploymentRecoveryReceipt(nativeKey,receiptId){
   const tx=get();await tx.readDeploymentTarget(nativeKey);
   const rows=await sql.$queryRawUnsafe<Array<{receiptJson:unknown;receiptDigest:string;actionId:string;effectIndex:number;nativeKey:string;generation:number}>>('SELECT "receiptJson","receiptDigest","actionId","effectIndex","nativeKey",generation FROM "PlatformDeploymentRequestReceipt" WHERE id=$1',receiptId);if(rows.length!==1)return fail();
   const row=rows[0],r=readDeploymentRequestReceipt(row.receiptJson);
   if(r.receiptId!==receiptId||r.nativeKey!==nativeKey||row.nativeKey!==r.nativeKey||row.receiptDigest!==r.receiptDigest||row.actionId!==r.actionId||row.effectIndex!==r.effectIndex||row.generation!==r.generation)return fail();
   const originals=await sql.$queryRawUnsafe<Array<{stateJson:unknown}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',r.actionId);if(originals.length!==1)return fail();const original=readPlatformAction(originals[0].stateJson),effect=original.plan.effects[r.effectIndex];
   if(original.plan.digest!==r.planDigest||original.plan.sourceDigest!==r.sourceDigest||!effect||effect.kind!=='deployment.vercel'||nativeDeploymentKey(effect)!==nativeKey)return fail();
   const events=await sql.$queryRawUnsafe<Array<{receipt:unknown}>>(`SELECT "detailJson"->'deploymentReceipt' AS receipt FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind='effect.observed' AND "detailJson"->'deploymentReceipt'->>'receiptId'=$2 LIMIT 2`,r.actionId,receiptId);if(events.length!==1||readDeploymentRequestReceipt(events[0].receipt).receiptDigest!==r.receiptDigest)return fail();return r;
  },
  async readDeploymentRecoveryPlan(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{plan:unknown}>>(`SELECT "detailJson"->'deploymentRecoveryPlan' AS plan FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind='proposed' AND "detailJson" ? 'deploymentRecoveryPlan' LIMIT 2`,id);if(rows.length!==1)return fail();const plan=readDeploymentRecoveryPlan(rows[0].plan),parent=readPlatformAction(await get().read(id));if(compileDeploymentRecoveryPlatformPlan(plan).digest!==parent.plan.digest)return fail();return plan},
  async readDeploymentReleaseObservation(id){check(id);const tx=get(),rows=await sql.$queryRawUnsafe<Array<{detail:{planDigest?:unknown;status?:unknown;outcome?:unknown;effectIndex?:unknown;deploymentReleaseObservation?:unknown}}>>(`SELECT "detailJson" AS detail FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind='effect.observed' AND "detailJson" ? 'deploymentReleaseObservation' LIMIT 2`,id);if(rows.length>1)return fail();if(rows.length===0)return null;const parent=readPlatformAction(await tx.read(id)),plan=readDeploymentRecoveryPlan(await tx.readDeploymentRecoveryPlan(id)),detail=rows[0].detail,e=deploymentTerminalObservationSchema.parse(detail.deploymentReleaseObservation);if(parent.status!=='confirmed'||detail.status!=='confirmed'||detail.outcome!=='confirmed'||detail.effectIndex!==0||detail.planDigest!==parent.plan.digest||e.nativeKey!==plan.nativeKey||e.generation!==plan.generation||e.actionId!==plan.originalActionId||e.requestReceiptDigest!==plan.requestReceiptDigest||e.providerDeploymentId!==plan.providerDeploymentId||e.profileDigest!==plan.profileDigest||e.observedAt<parent.createdAt||e.observedAt>parent.updatedAt)return fail();return e},
  async releaseDeploymentReservation(rawPlan,evidence,next){
   const tx=get(),plan=readDeploymentRecoveryPlan(rawPlan),id=currentAction();if(id===null)return fail();check(id);const parent=readPlatformAction(await tx.read(id));
   if(parent.status!=='claimed'||parent.plan.effects.length!==1||parent.plan.effects[0].kind!=='deployment.target.release'||compileDeploymentRecoveryPlatformPlan(plan).digest!==parent.plan.digest||readDeploymentRecoveryPlan(await tx.readDeploymentRecoveryPlan(id)).digest!==plan.digest||await tx.readEffect(id,0)!=='claimed')return fail();
   const prior=await tx.readDeploymentTarget(plan.nativeKey),receipt=await tx.readDeploymentRecoveryReceipt(plan.nativeKey,plan.requestReceiptId),now=await tx.now(),expected=validateDeploymentRecoveryEvidence(plan,prior,receipt,evidence,now);
   readDeploymentReservation(next);if(!prior||evidence.observedAt<parent.updatedAt||next.updatedAt>now||next.updatedAt<prior.updatedAt||next.updatedAt<evidence.observedAt)return fail();
   // Store time may advance from the service's last check, but every other byte
   // must equal the exact validated transition. No owner or epoch transfer.
   if(sha256ContentHash({...next,updatedAt:now})!==sha256ContentHash(expected))return fail();
   const count=await sql.$executeRawUnsafe('UPDATE "PlatformDeploymentTarget" SET version=$1,"stateJson"=$2::jsonb,"updatedAt"=clock_timestamp() WHERE "nativeKey"=$3 AND "actionId"=$4 AND generation=$5 AND version=$6',next.version,JSON.stringify(next),plan.nativeKey,plan.originalActionId,plan.generation,plan.expectedReservationVersion);if(count!==1)return fail();
  },
 };
}
export async function deploymentRecoveryEventDetail(tx:DeploymentRecoveryTransaction,event:Parameters<PlatformTransaction['event']>[0]){
 const release=event.state.plan.effects.some(e=>e.kind==='deployment.target.release');
 if(!release){if(event.deploymentRecoveryPlan!==undefined||event.deploymentReleaseObservation!==undefined)return fail();return {}}
 if(event.state.plan.effects.length!==1)return fail();
 let plan;
 if(event.kind==='proposed'){
  plan=readDeploymentRecoveryPlan(event.deploymentRecoveryPlan);if(event.state.status!=='proposed'||compileDeploymentRecoveryPlatformPlan(plan).digest!==event.state.plan.digest)return fail();
 }else{
  if(event.deploymentRecoveryPlan!==undefined)return fail();plan=readDeploymentRecoveryPlan(await tx.readDeploymentRecoveryPlan(event.actionId));
 }
 if(event.deploymentReleaseObservation!==undefined){
  const evidence=deploymentTerminalObservationSchema.parse(event.deploymentReleaseObservation),target=await tx.readDeploymentTarget(plan.nativeKey);
  if(event.kind!=='effect.observed'||event.outcome!=='confirmed'||event.effectIndex!==0||event.state.status!=='confirmed'||!target||target.phase!=='released'||target.actionId!==plan.originalActionId||target.generation!==plan.generation||target.version!==plan.expectedReservationVersion+1||target.requestReceiptDigest!==plan.requestReceiptDigest||target.releaseObservationDigest!==sha256ContentHash(evidence)||evidence.profileDigest!==plan.profileDigest)return fail();
 }else if(event.kind==='effect.observed'&&event.outcome==='confirmed')return fail();
 return {...(event.kind==='proposed'?{deploymentRecoveryPlan:plan}:{}),...(event.deploymentReleaseObservation===undefined?{}:{deploymentReleaseObservation:event.deploymentReleaseObservation})};
}
