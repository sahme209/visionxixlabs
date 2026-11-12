import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
import {readPlatformAction} from '../kernel';
import {compileOperationalEcsPlan} from './ecsPreparation';
import {readOperationalDelegation,type OperationalDelegationTransaction} from './delegationContract';
import {readOperationalManifest} from './kernel';
import {assertCustodianAdmission,readCustodianBarrier} from './custodianDrainKernel';
import type {CustodianDrainTransaction} from './custodianDrainStore';
import {compileCustodianIntent,readCustodianIntent,type CustodianIntent,type CustodianIntentStage} from './custodianIntentContract';
const admission=z.object({nativeKey:digest,issuerProfileDigest:digest,admissionDigest:digest,generation:z.number().int().min(1),version:z.number().int().min(1)}).strict();
export interface CustodianIntentTransaction extends OperationalDelegationTransaction,Pick<CustodianDrainTransaction,'lockCustodian'|'readCustodianBarrier'>{
 readCustodianIntent(id:string):Promise<unknown|null>;
 insertCustodianIntent(state:CustodianIntent):Promise<void>;
}
interface Source{
 /** Protected issuer metadata only, before any credential supplier is called.
  * Must bind the actual physical custodian/profile/admission, not client JSON. */
 readAdmission(tx:CustodianIntentTransaction,manifest:ReturnType<typeof readOperationalManifest>):Promise<unknown>;
 assertCurrent(tx:CustodianIntentTransaction,selected:z.infer<typeof admission>,manifest:ReturnType<typeof readOperationalManifest>):Promise<void>;
}
const fail=():never=>{throw Error('platform_custodian_intent_admission_unavailable')};
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
/** Called inside the original action transaction AFTER its current human,
 * workload, source and target checks. No public request/default source exists.
 * Returning an intent cannot bypass those caller checks or authorize a send. */
export function createCustodianIntentAdmission(source:Source){return Object.freeze({async reserve(tx:CustodianIntentTransaction,actionId:string,rawStage:CustodianIntentStage){
 const state=readOperationalDelegation(await tx.readDelegation(actionId)),parent=readPlatformAction(await tx.read(actionId)),manifest=state.manifest;
 if(state.actionId!==actionId||manifest.kind!=='deployment.ecs'||!manifest.issuerProfileDigest||state.status!=='claimed'||!state.executionPrincipal||parent.status!=='claimed'||parent.plan.digest!==state.parentPlanDigest||parent.plan.digest!==compileOperationalEcsPlan(manifest).digest||!same(parent.requester,state.requester)||!same(parent.reviewer,state.reviewer))return fail();
 const selected=admission.parse(await source.readAdmission(tx,manifest));if(selected.issuerProfileDigest!==manifest.issuerProfileDigest)return fail();
 await tx.lockCustodian(selected.nativeKey);const barrier=readCustodianBarrier(await tx.readCustodianBarrier(selected.nativeKey));assertCustodianAdmission(barrier,selected);await source.assertCurrent(tx,selected,manifest);
 const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||now<barrier.updatedAt||now>=Date.parse(manifest.expiresAt))return fail();
 const intent=compileCustodianIntent({format:1,scope:'platform',actionId,manifestDigest:manifest.digest,nativeKey:selected.nativeKey,issuerProfileDigest:selected.issuerProfileDigest,admissionDigest:selected.admissionDigest,generation:selected.generation,barrierVersion:selected.version,stage:rawStage,createdAt:now});
 if(await tx.readCustodianIntent(intent.id)!==null)return fail();
 if(intent.stage==='source.acquire'){if(state.version!==2||state.credential.status!=='pending'||state.sourceCredential?.status!=='pending')return fail()}
 else{
  if(state.sourceCredential?.status!=='issued'||now>=state.sourceCredential.expiresAt)return fail();
  const previous=compileCustodianIntent({...intentSelection(intent),stage:intent.stage==='role.acquire'?'source.acquire':'role.acquire'}),record=readCustodianIntent(await tx.readCustodianIntent(previous.id));
  if(record.actionId!==actionId||record.nativeKey!==selected.nativeKey||record.manifestDigest!==manifest.digest||record.issuerProfileDigest!==selected.issuerProfileDigest||record.admissionDigest!==selected.admissionDigest||record.generation!==selected.generation||record.barrierVersion!==selected.version||record.createdAt>now)return fail();
  if(intent.stage==='role.acquire'){if(state.version!==2||state.credential.status!=='pending')return fail()}
  else if(state.version!==3||state.credential.status!=='issued'||now>=state.credential.expiresAt||await tx.readEffect(actionId,0)!=='claimed')return fail();
 }
 await tx.insertCustodianIntent(intent);await source.assertCurrent(tx,selected,manifest);assertCustodianAdmission(await tx.readCustodianBarrier(selected.nativeKey),selected);
 const after=await tx.now();if(after<now||after>=Date.parse(manifest.expiresAt)||state.sourceCredential?.status==='issued'&&after>=state.sourceCredential.expiresAt||state.credential.status==='issued'&&after>=state.credential.expiresAt)return fail();return intent;
}})}
function intentSelection(intent:CustodianIntent){const {id,digest,status,hold,executionAuthorized,closureObserved,...selected}=intent;return selected}
