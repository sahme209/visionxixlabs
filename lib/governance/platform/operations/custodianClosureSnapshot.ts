import {custodianCredentialState} from './custodianCredentialContract';
import {operationalCredentialState} from './credentialContract';
import {operationalTargetReference} from './reservationContract';
import {digest} from '../contracts';
import type {CustodianDrainTransaction} from './custodianDrainStore';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readPlatformAction} from '../kernel';
import {compileOperationalEcsPlan} from './ecsPreparation';
import {readOperationalDelegation} from './delegationContract';
import {readCustodianBarrier} from './custodianDrainKernel';
import {readCustodianIntent} from './custodianIntentContract';
const row=z.object({id:z.string(),nativeKey:z.string(),actionId:z.string(),intentJson:z.unknown(),delegationJson:z.unknown(),parentJson:z.unknown()}).strict();
const savedSnapshot=z.object({format:z.literal(1),purpose:z.literal('platform_custodian_closure_snapshot_v1'),barrier:z.unknown(),entries:z.array(z.object({intent:z.unknown(),source:custodianCredentialState,credential:operationalCredentialState,targetReservation:operationalTargetReference,delegationDigest:digest,parentDigest:digest}).strict()).max(128),digest,coverage:z.literal('recorded_issuer_intents_only'),executionAuthorized:z.literal(false),closureObserved:z.literal(false),providerOutcomeReconciled:z.literal(false)}).strict();
const fail=():never=>{throw Error('platform_custodian_closure_snapshot_unavailable')};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v)}return v}
/** Bounded recorded evidence only. Unknown/expired histories remain present.
 * No native closure, fleet completeness, target reconciliation or permission is
 * inferred from this data, its digest or an empty array. */
export function compileCustodianClosureSnapshot(rawBarrier:unknown,rawRows:unknown){
 const barrier=readCustodianBarrier(rawBarrier);if(barrier.mode!=='draining'||!Array.isArray(rawRows)||rawRows.length>128)return fail();
 let budget=1048576;const seen=new Set<string>();
 const entries=rawRows.map(raw=>{
  const bytes=new TextEncoder().encode(JSON.stringify(raw)).length;budget-=bytes;if(bytes>131072||budget<0)return fail();
  const saved=row.parse(raw),intent=readCustodianIntent(saved.intentJson),state=readOperationalDelegation(saved.delegationJson),parent=readPlatformAction(saved.parentJson);
  if(saved.id!==intent.id||saved.nativeKey!==intent.nativeKey||saved.actionId!==intent.actionId||seen.has(intent.id)||intent.nativeKey!==barrier.nativeKey||intent.issuerProfileDigest!==barrier.issuerProfileDigest||intent.generation>barrier.generation||intent.barrierVersion>=barrier.version||intent.createdAt>barrier.updatedAt)return fail();seen.add(intent.id);
  if(state.actionId!==intent.actionId||state.status!=='claimed'||state.credential.status==='not_requested'||state.manifest.kind!=='deployment.ecs'||state.manifest.digest!==intent.manifestDigest||state.manifest.issuerProfileDigest!==intent.issuerProfileDigest||!state.sourceCredential||intent.createdAt<state.createdAt||parent.plan.digest!==state.parentPlanDigest||parent.plan.digest!==compileOperationalEcsPlan(state.manifest).digest||!['claimed','confirmed','unknown'].includes(parent.status)||sha256ContentHash(parent.requester)!==sha256ContentHash(state.requester)||sha256ContentHash(parent.reviewer)!==sha256ContentHash(state.reviewer))return fail();
  if((intent.stage!=='source.acquire'&&state.sourceCredential.status!=='issued')||(intent.stage==='ecs.send'&&state.credential.status!=='issued')||(['confirmed','unknown'].includes(parent.status)&&state.credential.status!=='issued'))return fail();
  return {intent,source:state.sourceCredential,credential:state.credential,targetReservation:state.targetReservation,delegationDigest:sha256ContentHash(state),parentDigest:sha256ContentHash(parent)};
 }).sort((a,b)=>a.intent.id<b.intent.id?-1:a.intent.id>b.intent.id?1:0);
 const body={format:1 as const,purpose:'platform_custodian_closure_snapshot_v1' as const,barrier,entries};
 return freeze({...body,digest:sha256ContentHash(body),coverage:'recorded_issuer_intents_only' as const,executionAuthorized:false as const,closureObserved:false as const,providerOutcomeReconciled:false as const});
}
export type CustodianClosureSnapshot=ReturnType<typeof compileCustodianClosureSnapshot>;

export interface CustodianClosureTransaction extends CustodianDrainTransaction{
 readCustodianClosureHistory(actionId:string):Promise<unknown[]>;
 readCustodianClosure(nativeKey:string):Promise<unknown|null>;
 readCustodianClosureSnapshot(nativeKey:string):Promise<CustodianClosureSnapshot>;
}

/** Stored snapshot integrity, not re-qualification of its original SQL rows. */
export function readCustodianClosureSnapshot(raw:unknown){
 const parsed=savedSnapshot.parse(raw),barrier=readCustodianBarrier(parsed.barrier);if(barrier.mode!=='draining'||new TextEncoder().encode(JSON.stringify(raw)).length>1048576)return fail();
 const seen=new Set<string>(),entries=parsed.entries.map(saved=>{const intent=readCustodianIntent(saved.intent);if(seen.has(intent.id)||intent.nativeKey!==barrier.nativeKey||intent.issuerProfileDigest!==barrier.issuerProfileDigest||intent.generation>barrier.generation||intent.barrierVersion>=barrier.version||intent.createdAt>barrier.updatedAt||saved.credential.status==='not_requested'||intent.stage!=='source.acquire'&&saved.source.status!=='issued'||intent.stage==='ecs.send'&&saved.credential.status!=='issued'||saved.source.status==='issued'&&saved.source.profileDigest!==intent.issuerProfileDigest)return fail();seen.add(intent.id);return {...saved,intent}});
 const body={format:1 as const,purpose:'platform_custodian_closure_snapshot_v1' as const,barrier,entries};if(sha256ContentHash(body)!==parsed.digest)return fail();return freeze({...body,digest:parsed.digest,coverage:parsed.coverage,executionAuthorized:false as const,closureObserved:false as const,providerOutcomeReconciled:false as const});
}
