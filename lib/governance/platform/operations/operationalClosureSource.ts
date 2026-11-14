import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {assertExecutionWindow,type ExecutionTimeSource} from '../executionTime';
import {readOperationalTimeObservation,type OperationalNativeContext} from '../nativeTime/operationalSource';
import {digest} from '../contracts';
import {operationalEvidenceId} from './contracts';
import {compileOperationalExpiryClosure,operationalExpiryEvidenceSchema,type OperationalExpiryEvidence} from './operationalClosureObservation';
import {readCustodianClosureSnapshot,type CustodianClosureSnapshot,type CustodianClosureTransaction} from './custodianClosureSnapshot';
import type {CustodianClosureObservation} from './custodianClosureObservation';
import type {CustodianDrainTransaction} from './custodianDrainStore';
import type {CustodianDrainPlan} from './custodianDrainContract';
import type {CustodianBarrier} from './custodianDrainKernel';
import type {ProviderExpiryReader} from './providerExpiryProvenance';
const stamp=z.number().int().nonnegative().safe();
const nativeScope=z.object({scopeDigest:digest,nativeKey:digest,issuerProfileDigest:digest,generation:z.number().int().positive(),barrierVersion:stamp,snapshotDigest:digest,controlDigest:digest,fleetReceiptId:operationalEvidenceId,runtimeReceiptId:operationalEvidenceId,lifetimeReceiptId:operationalEvidenceId,expiresAt:stamp,lastPossibleIssueAt:stamp,leases:z.array(z.object({intentId:z.string(),scope:z.enum(['source','derived']),leaseRef:z.string(),receiptId:operationalEvidenceId}).strict()).max(256)}).strict();
type Scope=z.infer<typeof nativeScope>;
/** Actual fixed administrative custody/fleet bridge, NOT a time-qualification
 * callback. It must authenticate original native scope handles, full inventory,
 * issuance cutoff and quiescent in-flight work. No implementation/default is
 * inferred from structural objects. Tests intercept this native boundary. */
export interface OperationalClosureNativeBridge {
 readonly context:OperationalNativeContext;
 assertReadAllowed(snapshot:CustodianClosureSnapshot,signal:AbortSignal):Promise<void>;
 captureEvidence(snapshot:CustodianClosureSnapshot,signal:AbortSignal):Promise<Scope>;
 assertEvidenceCurrent(snapshot:CustodianClosureSnapshot,original:Scope,signal:AbortSignal):Promise<void>;
}
const fail=():never=>{throw Error('operational_closure_source_unavailable')};
export function createOperationalProviderExpiryClosureSource(clock:ExecutionTimeSource,providers:Readonly<{source:ProviderExpiryReader;derived:ProviderExpiryReader}>,native:OperationalClosureNativeBridge,signal:AbortSignal){
 const context=native.context,expected=Object.freeze({...context}),allowed=native.assertReadAllowed.bind(native),capture=native.captureEvidence.bind(native),current=native.assertEvidenceCurrent.bind(native);
 const sourceRead=providers.source.readObservedProviderExpiry.bind(providers.source),derivedRead=providers.derived.readObservedProviderExpiry.bind(providers.derived);
 const permits=new Set<string>(),issued=new Map<string,{scope:Scope;snapshotDigest:string;scopeDigest:string;expiryDigest:string}>();
 function active(){signal.throwIfAborted();if(native.context!==context||Object.keys(expected).some(k=>context[k as keyof OperationalNativeContext]!==expected[k as keyof OperationalNativeContext]))return fail()}
 async function time(){active();const observation=await assertExecutionWindow(clock,{},signal),o=readOperationalTimeObservation(observation);active();if(!o||o.profileDigest!==expected.profileDigest||o.revision!==expected.revision||o.hostGeneration!==expected.hostGeneration||o.sourceGeneration!==expected.sourceGeneration)return fail();return o}
 function originalExpiries(snapshot:CustodianClosureSnapshot){
  const values=[];
  for(const entry of snapshot.entries)for(const [slot,lease]of [['source',entry.source],['derived',entry.credential]]as const){
   if(lease.status!=='issued')return fail();const raw=(slot==='source'?sourceRead:derivedRead)(lease.leaseRef);if(!raw)return fail();
   const record=Object.freeze({leaseRef:raw.leaseRef,expiresAt:raw.expiresAt,scope:raw.scope,provider:raw.provider,manifestDigest:raw.manifestDigest,issuerProfileDigest:raw.issuerProfileDigest});
   if(record.scope!==slot||record.provider!=='aws-sts-temporary'||record.leaseRef!==lease.leaseRef||record.expiresAt!==lease.expiresAt||record.manifestDigest!==entry.intent.manifestDigest||record.issuerProfileDigest!==snapshot.barrier.issuerProfileDigest)return fail();
   values.push(Object.freeze({intentId:entry.intent.id,...record}));
  }return Object.freeze(values);
 }
 function exact(snapshot:CustodianClosureSnapshot,scope:Scope){const b=snapshot.barrier;if(scope.nativeKey!==b.nativeKey||scope.issuerProfileDigest!==b.issuerProfileDigest||scope.generation!==b.generation||scope.barrierVersion!==b.version||scope.snapshotDigest!==snapshot.digest||scope.controlDigest!==b.controlDigest)return fail()}
 const source=Object.freeze({clock,
  async assertReadAllowed(_tx:CustodianDrainTransaction,snapshot:CustodianClosureSnapshot){active();const parsed=readCustodianClosureSnapshot(snapshot);const expiryDigest=hash(originalExpiries(parsed));await time();await allowed(parsed,signal);active();if(hash(originalExpiries(parsed))!==expiryDigest)return fail();permits.add(parsed.digest)},
  async readEvidence(_tx:CustodianDrainTransaction,snapshot:CustodianClosureSnapshot){
   active();const parsed=readCustodianClosureSnapshot(snapshot);if(!permits.delete(parsed.digest)||issued.size>=128)return fail();
   const originals=originalExpiries(parsed),expiryDigest=hash(originals);
   const original=await capture(parsed,signal);active();const scope=nativeScope.parse(original),scopeDigest=hash(scope);exact(parsed,scope);await current(parsed,original,signal);active();if(hash(nativeScope.parse(original))!==scopeDigest)return fail();
   const leases:OperationalExpiryEvidence['leases']=[];let maximum=0;
   for(const entry of parsed.entries)for(const [slot,lease]of [['source',entry.source],['derived',entry.credential]]as const){
    if(lease.status!=='issued')return fail();const record=originals.find(v=>v.intentId===entry.intent.id&&v.scope===slot),receipts=scope.leases.filter(v=>v.intentId===entry.intent.id&&v.scope===slot);
    if(!record||record.scope!==slot||record.provider!=='aws-sts-temporary'||record.leaseRef!==lease.leaseRef||record.expiresAt!==lease.expiresAt||record.manifestDigest!==entry.intent.manifestDigest||record.issuerProfileDigest!==parsed.barrier.issuerProfileDigest||receipts.length!==1||receipts[0].leaseRef!==lease.leaseRef)return fail();
    maximum=Math.max(maximum,record.expiresAt);leases.push({scope:slot,intentId:entry.intent.id,leaseRef:record.leaseRef,expiresAt:record.expiresAt,provider:record.provider,receiptId:receipts[0].receiptId});
   }
   // A complete native observer must cover the whole original cohort even for
   // zero local rows. Empty ledger alone never establishes native cutoff.
   if(scope.leases.length!==leases.length||hash(originalExpiries(parsed))!==expiryDigest)return fail();
   const o=await time();await current(parsed,original,signal);active();if(hash(nativeScope.parse(original))!==scopeDigest)return fail();
   const evidence=operationalExpiryEvidenceSchema.parse({format:2,purpose:'platform_custodian_operational_provider_expiry_v1',nativeKey:scope.nativeKey,issuerProfileDigest:scope.issuerProfileDigest,generation:scope.generation,barrierVersion:scope.barrierVersion,controlDigest:scope.controlDigest,snapshotDigest:parsed.digest,fleetReceiptId:scope.fleetReceiptId,runtimeReceiptId:scope.runtimeReceiptId,lifetimeReceiptId:scope.lifetimeReceiptId,timeReceiptId:'platform_evidence_'+randomUUID(),lastPossibleIssueAt:scope.lastPossibleIssueAt,credentialNotAfter:Math.max(maximum,scope.lastPossibleIssueAt),expiresAt:scope.expiresAt,operationalTime:{profileDigest:o.profileDigest,revision:o.revision,hostGeneration:o.hostGeneration,sourceGeneration:o.sourceGeneration,unixTimeNs:String(o.unixTimeNs)},custodyScopeDigest:scope.scopeDigest,leases});
   // Pure numerical validity supplements, never replaces, the two native checks.
   compileOperationalExpiryClosure(parsed,evidence,'operational-source',Math.max(parsed.barrier.updatedAt,scope.lastPossibleIssueAt));if(hash(originalExpiries(parsed))!==expiryDigest)return fail();issued.set(hash(evidence),{scope:original,snapshotDigest:parsed.digest,scopeDigest,expiryDigest});return Object.freeze(evidence);
  },
  async assertCurrent(_tx:CustodianDrainTransaction,snapshot:CustodianClosureSnapshot,raw:unknown){active();const evidence=operationalExpiryEvidenceSchema.parse(raw),record=issued.get(hash(evidence));if(!record||record.snapshotDigest!==snapshot.digest||hash(originalExpiries(snapshot))!==record.expiryDigest||hash(nativeScope.parse(record.scope))!==record.scopeDigest)return fail();exact(snapshot,nativeScope.parse(record.scope));await allowed(snapshot,signal);await current(snapshot,record.scope,signal);active();if(hash(originalExpiries(snapshot))!==record.expiryDigest||hash(nativeScope.parse(record.scope))!==record.scopeDigest)return fail()},
 });
 return Object.freeze({...source,
  bindDrainSource(base:{clock:ExecutionTimeSource;assertCurrent(tx:CustodianDrainTransaction,control:CustodianDrainPlan):Promise<void>;assertAbortSafe(tx:CustodianDrainTransaction,control:CustodianDrainPlan,prior:CustodianBarrier,observation:CustodianClosureObservation|null):Promise<void>}){
   if(base.clock!==clock)return fail();const currentControl=base.assertCurrent.bind(base),abortSafe=base.assertAbortSafe.bind(base);
   return Object.freeze({clock,assertCurrent:currentControl,
    async assertAbortSafe(tx:CustodianDrainTransaction,control:CustodianDrainPlan,prior:CustodianBarrier,observation:CustodianClosureObservation|null){
     active();if(!observation||observation.format!==2||hash(observation.snapshot.barrier)!==hash(prior)||observation.snapshot.barrier.nativeKey!==control.nativeKey||observation.snapshot.barrier.issuerProfileDigest!==control.issuerProfileDigest)return fail();
     // Authenticate original issued metadata + current custody scope before
     // either original native safety decision. Serialized history is not proof.
     await source.assertCurrent(tx,observation.snapshot,observation.evidence);await abortSafe(tx,control,prior,observation);active();
     await source.assertCurrent(tx,observation.snapshot,observation.evidence);
    },
   });
  },
 });
}
