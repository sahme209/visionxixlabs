import {z} from 'zod';
import {digest,platformPrincipalSchema} from '../contracts';
import {operationalEvidenceId} from './contracts';
import {readCustodianClosureSnapshot} from './custodianClosureSnapshot';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const stamp=z.number().int().nonnegative().safe(),generation=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const ns=z.string().regex(/^(0|[1-9][0-9]{0,18})$/).refine(v=>BigInt(v)<=(BigInt(1)<<BigInt(63))-BigInt(1));
export const operationalExpiryEvidenceSchema=z.object({
 format:z.literal(2),purpose:z.literal('platform_custodian_operational_provider_expiry_v1'),nativeKey:digest,issuerProfileDigest:digest,generation:z.number().int().positive(),barrierVersion:z.number().int().nonnegative(),controlDigest:digest,snapshotDigest:digest,
 fleetReceiptId:operationalEvidenceId,runtimeReceiptId:operationalEvidenceId,lifetimeReceiptId:operationalEvidenceId,timeReceiptId:operationalEvidenceId,lastPossibleIssueAt:stamp,credentialNotAfter:stamp,expiresAt:stamp,
 operationalTime:z.object({profileDigest:digest,revision:z.number().int().positive().safe(),hostGeneration:generation,sourceGeneration:generation,unixTimeNs:ns}).strict(),custodyScopeDigest:digest,
 leases:z.array(z.object({scope:z.enum(['source','derived']),intentId:z.string(),leaseRef:z.string().regex(/^platform_credential_[a-f0-9-]{36}$/),expiresAt:stamp,provider:z.literal('aws-sts-temporary'),receiptId:operationalEvidenceId}).strict()).max(256),
}).strict();
export type OperationalExpiryEvidence=z.infer<typeof operationalExpiryEvidenceSchema>;
const fail=():never=>{throw Error('platform_operational_closure_unavailable')};
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value)}return value}
/** Pure coherence, NOT native provenance or permission. Live owner must resolve
 * original custody/fleet/expiry issuance plus authentic operational observation. */
export function compileOperationalExpiryClosure(rawSnapshot:unknown,rawEvidence:unknown,rawObserver:string,observedAt:number){
 const snapshot=readCustodianClosureSnapshot(rawSnapshot),evidence=operationalExpiryEvidenceSchema.parse(rawEvidence),observerUserId=platformPrincipalSchema.shape.userId.parse(rawObserver),b=snapshot.barrier;stamp.parse(observedAt);
 const current=BigInt(evidence.operationalTime.unixTimeNs);
 if(evidence.nativeKey!==b.nativeKey||evidence.issuerProfileDigest!==b.issuerProfileDigest||evidence.generation!==b.generation||evidence.barrierVersion!==b.version||evidence.controlDigest!==b.controlDigest||evidence.snapshotDigest!==snapshot.digest||evidence.lastPossibleIssueAt<b.updatedAt||evidence.credentialNotAfter<evidence.lastPossibleIssueAt||current<=BigInt(evidence.credentialNotAfter)*BigInt(1000000)||current>=BigInt(evidence.expiresAt)*BigInt(1000000)||evidence.expiresAt<=observedAt||observedAt<b.updatedAt)return fail();
 if(evidence.leases.length!==snapshot.entries.length*2)return fail();
 const seen=new Set<string>();
 for(const entry of snapshot.entries){
  if(entry.intent.createdAt>evidence.lastPossibleIssueAt)return fail();
  for(const [scope,lease] of [['source',entry.source],['derived',entry.credential]] as const){
   // Unknown/pending/not_requested is not a provider-backed expiry. No requested
   // duration or host timestamp repairs an unobserved acquisition.
   if(lease.status!=='issued'||lease.expiresAt>evidence.credentialNotAfter||lease.requestedAt>observedAt||lease.observedAt>observedAt)return fail();
   const key=entry.intent.id+'/'+scope,proof=evidence.leases.filter(v=>v.intentId===entry.intent.id&&v.scope===scope);
   if(seen.has(key)||proof.length!==1||proof[0].leaseRef!==lease.leaseRef||proof[0].expiresAt!==lease.expiresAt)return fail();seen.add(key);
  }
 }
 const body={format:2 as const,scope:'platform' as const,purpose:'platform_custodian_operational_expiry_closure_observation_v1' as const,snapshot,evidence,observerUserId,observedAt,authority:'historical_credential_closure_observation_only' as const,executionAuthorized:false as const,providerOutcomeReconciled:false as const,closureAssurance:'aws-linux-operational-provider-expiry' as const,physicalUtcClosureProven:false as const},hash=sha256ContentHash(body);
 return freeze({...body,id:'platform_operational_closure_'+hash,digest:hash});
}
export function readOperationalExpiryClosure(raw:unknown){
 const saved=z.object({format:z.literal(2),scope:z.literal('platform'),purpose:z.literal('platform_custodian_operational_expiry_closure_observation_v1'),snapshot:z.unknown(),evidence:z.unknown(),observerUserId:platformPrincipalSchema.shape.userId,observedAt:stamp,authority:z.literal('historical_credential_closure_observation_only'),executionAuthorized:z.literal(false),providerOutcomeReconciled:z.literal(false),closureAssurance:z.literal('aws-linux-operational-provider-expiry'),physicalUtcClosureProven:z.literal(false),id:z.string(),digest}).strict().parse(raw);
 const expected=compileOperationalExpiryClosure(saved.snapshot,saved.evidence,saved.observerUserId,saved.observedAt);if(saved.id!==expected.id||saved.digest!==expected.digest)return fail();return expected;
}
