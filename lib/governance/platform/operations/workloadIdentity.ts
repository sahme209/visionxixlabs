import {assertExecutionWindow,type ExecutionTimeSource} from '../executionTime';
import 'server-only';
import {z} from 'zod';
import {createLocalJWKSet,jwtVerify} from 'jose';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
import {operationalWorkloadReference} from './contracts';
const numericId=z.string().regex(/^[1-9][0-9]{0,19}$/);
const label=z.string().regex(/^[-A-Za-z0-9_]{1,256}$/),issuer=z.literal('https://token.actions.githubusercontent.com');
export const operationalWorkloadBinding=z.object({actionId:z.string().regex(/^platform_action_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),manifestDigest:digest,workload:operationalWorkloadReference,expiresAt:z.string().max(40).datetime()}).strict();
export type OperationalWorkloadBinding=z.infer<typeof operationalWorkloadBinding>;
const profileSchema=z.object({environment:operationalWorkloadReference.shape.environment,protectionRevision:operationalWorkloadReference.shape.protectionRevision,format:z.literal(1),issuer,audience:label,subject:z.string().min(1).max(512),repository:operationalWorkloadReference.shape.repository,repositoryId:numericId,repositoryOwnerId:numericId,workflowPath:operationalWorkloadReference.shape.workflowPath,workflowCommit:z.string().regex(/^[a-f0-9]{40}$/),workflowSha256:digest,maximumLifetimeSeconds:z.number().int().min(1).max(600),keys:z.array(z.object({kty:z.literal('RSA'),alg:z.literal('RS256'),use:z.literal('sig'),kid:label,n:z.string().regex(/^[A-Za-z0-9_-]{342,1366}$/),e:z.string().regex(/^[A-Za-z0-9_-]{2,16}$/)}).strict()).min(1).max(16)}).strict();
const seconds=z.number().int().nonnegative().safe();
const claimsSchema=z.object({environment:z.string().min(1).max(255).optional(),iss:issuer,aud:label,sub:z.string().min(1).max(512),jti:label,iat:seconds,nbf:seconds,exp:seconds,repository:z.string(),repository_id:numericId,repository_owner_id:numericId,repository_owner:z.literal('sahme209'),repository_visibility:z.literal('public'),event_name:z.literal('workflow_dispatch'),ref_type:z.literal('branch'),runner_environment:z.literal('github-hosted'),ref:z.string(),sha:z.string(),workflow_ref:z.string(),workflow_sha:z.string(),run_id:z.string(),run_attempt:z.string()});
export interface OperationalWorkloadTransaction{
 now():Promise<number>;
 /** Unique issuer/JTI reservation, atomically joined to the delegation claim.
  * Conflict/unknown must throw; never release/reset a consumed reservation. */
 reserveWorkloadIdentity(replayKey:string,actionId:string,manifestDigest:string):Promise<void>;
}
/** Server-private source only. Actual GitHub claim/key/source/run semantics are
 * NOT qualified by this parser or a source hash. No default supplier exists.
 * Qualification must bind the exact profile AND reviewed action/workload, with
 * current source/run/key provenance. Tests use explicit synthetic qualification.
 * readProfile/assertProfileCurrent must be read-only and transaction-bound. */
export interface OperationalWorkloadProfileSupplier{
 readProfile(tx:OperationalWorkloadTransaction,binding:OperationalWorkloadBinding):Promise<unknown>;
 assertProfileCurrent(tx:OperationalWorkloadTransaction,profileDigest:string,bindingDigest:string):Promise<void>;
}
const fail=():never=>{throw Error('operational_workload_unavailable')};
interface Verified{binding:OperationalWorkloadBinding;bindingDigest:string;profileDigest:string;replayKey:string;expiresAt:number;validFrom:number}
/** Suppliers receive only an immutable parsed copy, never the caller's object
 * or a mutable expected binding they could rewrite during an awaited read. */
function captureBinding(raw:unknown):OperationalWorkloadBinding{
 const binding=operationalWorkloadBinding.parse(raw);Object.freeze(binding.workload);return Object.freeze(binding);
}
/** Cryptographic candidate unit only, not a workload/provider execution grant.
 * Never returns/stores raw tokens or claims, and never trusts process env or a
 * human-session/static-token fallback. Public/default operational use is closed. */
export function createOperationalWorkloadIdentity(source:OperationalWorkloadProfileSupplier,clock:ExecutionTimeSource,signal:AbortSignal){
 const proofs=new WeakMap<object,Verified>(),consumed=new WeakMap<object,Verified>();
 async function profile(tx:OperationalWorkloadTransaction,binding:OperationalWorkloadBinding){
  const value=profileSchema.parse(await source.readProfile(tx,binding)),hash=sha256ContentHash(value);
  if(Boolean(binding.workload.environment)!==Boolean(binding.workload.protectionRevision)||value.environment!==binding.workload.environment||value.protectionRevision!==binding.workload.protectionRevision)fail();
  if(new Set(value.keys.map(k=>k.kid)).size!==value.keys.length||value.repository!==binding.workload.repository||value.workflowCommit!==binding.workload.workflowCommit||value.workflowPath!==binding.workload.workflowPath||value.workflowSha256!==binding.workload.workflowSha256)fail();
  await source.assertProfileCurrent(tx,hash,sha256ContentHash(binding));return {value,hash};
 }
 async function current(tx:OperationalWorkloadTransaction,verified:Verified,raw:unknown){
  signal.throwIfAborted();const binding=captureBinding(raw);if(sha256ContentHash(binding)!==verified.bindingDigest)fail();
  const p=await profile(tx,binding);if(p.hash!==verified.profileDigest)fail();
  await assertExecutionWindow(clock,{notBefore:verified.validFrom,expiresAt:Math.min(verified.expiresAt,Date.parse(binding.expiresAt))},signal);
  const afterProfile=await profile(tx,binding);signal.throwIfAborted();if(afterProfile.hash!==verified.profileDigest)fail();
  const now=await tx.now();signal.throwIfAborted();if(!Number.isSafeInteger(now)||now<0||now>=verified.expiresAt||now>=Date.parse(binding.expiresAt))fail();
 }
 return Object.freeze({
  async authenticate(tx:OperationalWorkloadTransaction,rawToken:unknown,rawBinding:unknown){
   try{
    signal.throwIfAborted();if(typeof rawToken!=='string'||Buffer.byteLength(rawToken)>32768||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(rawToken))return fail();
    const binding=captureBinding(rawBinding),p=await profile(tx,binding),now=await tx.now();if(!Number.isSafeInteger(now)||now<0||now>=Date.parse(binding.expiresAt))return fail();
    const {payload,protectedHeader}=await jwtVerify(rawToken,createLocalJWKSet({keys:p.value.keys}),{algorithms:['RS256'],issuer:p.value.issuer,audience:p.value.audience,currentDate:new Date(now),clockTolerance:0,requiredClaims:['iss','aud','sub','jti','iat','nbf','exp','repository','ref','sha','workflow_ref','workflow_sha','run_id','run_attempt','repository_id','repository_owner_id','repository_owner','repository_visibility','event_name','ref_type','runner_environment']});
    if(Object.keys(protectedHeader).some(key=>!['alg','kid','typ','x5t'].includes(key))||protectedHeader.typ!==undefined&&protectedHeader.typ!=='JWT'||typeof protectedHeader.kid!=='string'||protectedHeader.x5t!==undefined&&(typeof protectedHeader.x5t!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(protectedHeader.x5t)))return fail();
    if('job_workflow_ref' in payload||'job_workflow_sha' in payload)return fail();
    const claims=claimsSchema.parse(payload),w=binding.workload;
    if(w.environment!==undefined&&claims.environment!==w.environment)return fail();
    if(claims.repository_id!==p.value.repositoryId||claims.repository_owner_id!==p.value.repositoryOwnerId||claims.aud!==p.value.audience||claims.sub!==p.value.subject||claims.repository!==w.repository||claims.ref!==w.ref||claims.sha!==w.commit||claims.workflow_ref!==w.repository+'/'+w.workflowPath+'@'+w.ref||claims.workflow_sha!==w.workflowCommit||claims.run_id!==w.runId||claims.run_attempt!==String(w.attempt)||claims.iat*1000>now||claims.nbf*1000>now||claims.exp<=claims.iat||claims.exp-claims.iat>p.value.maximumLifetimeSeconds)return fail();
    await source.assertProfileCurrent(tx,p.hash,sha256ContentHash(binding));
    const end=Math.min(claims.exp*1000,Date.parse(binding.expiresAt)),after=await tx.now();if(!Number.isSafeInteger(after)||after<now||after>=end)return fail();
    const verified={binding,bindingDigest:sha256ContentHash(binding),profileDigest:p.hash,replayKey:sha256ContentHash({purpose:'platform_workload_replay_v1',issuer:claims.iss,jti:claims.jti}),expiresAt:end,validFrom:Math.max(claims.iat,claims.nbf)*1000};
    await current(tx,verified,binding);const final=await tx.now();signal.throwIfAborted();if(final<after||final>=end)return fail();
    const proof=Object.freeze(Object.create(null)) as object;proofs.set(proof,verified);return proof;
   }catch{return fail()}
  },
  async assertCurrent(tx:OperationalWorkloadTransaction,proof:object,binding:unknown):Promise<void>{try{const verified=proofs.get(proof);if(!verified)return fail();await current(tx,verified,binding);if(proofs.get(proof)!==verified)return fail()}catch{return fail()}},
  async assertConsumedCurrent(tx:OperationalWorkloadTransaction,proof:object,binding:unknown):Promise<void>{try{const verified=consumed.get(proof);if(!verified)return fail();await current(tx,verified,binding)}catch{return fail()}},
  /** Private facts for the ORIGINAL joined authorization owner, not an allow
   * decision. This does not sample time, mint/consume a proof or reserve a JTI.
   * The owner must validate the intersection with current human/native bounds,
   * then re-read these facts after its awaited currentness checks. */
  async readConsumedTimeWindow(tx:OperationalWorkloadTransaction,proof:object,raw:unknown):Promise<Readonly<{notBefore:number;expiresAt:number}>>{
   try{
    signal.throwIfAborted();const verified=consumed.get(proof);if(!verified)return fail();
    const binding=captureBinding(raw);if(sha256ContentHash(binding)!==verified.bindingDigest)return fail();
    const p=await profile(tx,binding);signal.throwIfAborted();
    if(p.hash!==verified.profileDigest||consumed.get(proof)!==verified)return fail();
    return Object.freeze({notBefore:verified.validFrom,expiresAt:verified.expiresAt});
   }catch{return fail()}
  },
  async consume(tx:OperationalWorkloadTransaction,proof:object,binding:unknown){
   const verified=proofs.get(proof);if(!verified)return fail();proofs.delete(proof);
   try{await current(tx,verified,binding);await tx.reserveWorkloadIdentity(verified.replayKey,verified.binding.actionId,verified.binding.manifestDigest);await current(tx,verified,binding);
    const result=Object.freeze({principalKind:'workload' as const,actionId:verified.binding.actionId,manifestDigest:verified.binding.manifestDigest,workload:Object.freeze({...verified.binding.workload}),replayKey:verified.replayKey,profileDigest:verified.profileDigest,expiresAt:verified.expiresAt,authority:'identity_only' as const,executionAuthorized:false as const});consumed.set(result,verified);return result;
   }catch{return fail()}
  },
 });
}
