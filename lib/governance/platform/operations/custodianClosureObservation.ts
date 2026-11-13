import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest,platformPrincipalSchema} from '../contracts';
import {operationalEvidenceId} from './contracts';
import {readCustodianClosureSnapshot} from './custodianClosureSnapshot';
const clock=z.number().int().nonnegative().safe();
/** Evidence data only. The protected source must independently qualify every
 * receipt, complete fleet/source/derived inventory, quiescence and trusted time.
 * Numeric coherence, an ID, a digest or identity-probe success is NOT proof. */
export const custodianClosureEvidence=z.object({format:z.literal(1),purpose:z.literal('platform_custodian_native_lifetime_evidence_v1'),nativeKey:digest,issuerProfileDigest:digest,generation:z.number().int().positive(),barrierVersion:z.number().int().nonnegative(),controlDigest:digest,snapshotDigest:digest,fleetReceiptId:operationalEvidenceId,runtimeReceiptId:operationalEvidenceId,lifetimeReceiptId:operationalEvidenceId,timeReceiptId:operationalEvidenceId,lastPossibleIssueAt:clock,credentialNotAfter:clock,trustedNow:z.object({earliest:clock,latest:clock}).strict(),expiresAt:clock}).strict();
export type CustodianClosureEvidence=z.infer<typeof custodianClosureEvidence>;
const fail=():never=>{throw Error('platform_custodian_closure_observation_unavailable')};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v)}return v}
export function compileCustodianClosureObservation(rawSnapshot:unknown,rawEvidence:unknown,rawObserver:string,observedAt:number){
 const snapshot=readCustodianClosureSnapshot(rawSnapshot),evidence=custodianClosureEvidence.parse(rawEvidence),observerUserId=platformPrincipalSchema.shape.userId.parse(rawObserver),barrier=snapshot.barrier;clock.parse(observedAt);
 if(evidence.nativeKey!==barrier.nativeKey||evidence.issuerProfileDigest!==barrier.issuerProfileDigest||evidence.generation!==barrier.generation||evidence.barrierVersion!==barrier.version||evidence.controlDigest!==barrier.controlDigest||evidence.snapshotDigest!==snapshot.digest||evidence.lastPossibleIssueAt<barrier.updatedAt||evidence.credentialNotAfter<evidence.lastPossibleIssueAt||evidence.trustedNow.earliest<=evidence.credentialNotAfter||evidence.trustedNow.latest<evidence.trustedNow.earliest||evidence.expiresAt<=observedAt||evidence.expiresAt<=evidence.trustedNow.latest||observedAt<barrier.updatedAt)return fail();
 for(const entry of snapshot.entries){if(entry.intent.createdAt>evidence.lastPossibleIssueAt)return fail();for(const lease of [entry.source,entry.credential]){if(lease.status==='issued'&&lease.expiresAt>evidence.credentialNotAfter||'requestedAt' in lease&&lease.requestedAt>observedAt||'observedAt' in lease&&lease.observedAt>observedAt)return fail()}}
 const body={format:1 as const,scope:'platform' as const,purpose:'platform_custodian_credential_closure_observation_v1' as const,snapshot,evidence,observerUserId,observedAt,authority:'historical_credential_closure_observation_only' as const,executionAuthorized:false as const,providerOutcomeReconciled:false as const},hash=sha256ContentHash(body);
 return freeze({...body,id:'platform_closure_'+hash,digest:hash});
}
export type CustodianClosureObservation=ReturnType<typeof compileCustodianClosureObservation>;
export function readCustodianClosureObservation(raw:unknown):CustodianClosureObservation{
 const saved=stored.parse(raw),expected=compileCustodianClosureObservation(saved.snapshot,saved.evidence,saved.observerUserId,saved.observedAt);
 if(saved.id!==expected.id||saved.digest!==expected.digest)return fail();return expected;
}
const stored=z.object({format:z.literal(1),scope:z.literal('platform'),purpose:z.literal('platform_custodian_credential_closure_observation_v1'),snapshot:z.unknown(),evidence:z.unknown(),observerUserId:platformPrincipalSchema.shape.userId,observedAt:clock,authority:z.literal('historical_credential_closure_observation_only'),executionAuthorized:z.literal(false),providerOutcomeReconciled:z.literal(false),id:z.string().regex(/^platform_closure_[a-f0-9]{64}$/),digest}).strict();
