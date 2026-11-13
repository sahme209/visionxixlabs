import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readPlatformAction} from '../kernel';
import type {PlatformPrincipal} from '../contracts';
import {readPlatformPrincipalTimeWindow} from '../principalTime';
import {assertExecutionWindow,type ExecutionTimeCheck} from '../executionTime';
import type {EcsDecisionTiming} from './ecsDecisionTime';
import {readOperationalDelegation,type OperationalDelegation,type OperationalDelegationTransaction} from './delegationContract';
import type {createOperationalWorkloadIdentity} from './workloadIdentity';
type Tx=OperationalDelegationTransaction;
type Manifest=OperationalDelegation['manifest'];
/** Explicit private read-only, clock-free fact ports. No alias/fallback to an
 * arbitrary timed qualifier. Their actual source/custody/current-use behavior
 * must be audited and qualified separately; function names prove nothing. */
export interface OperationalExecutionFacts{
 assertHumanCurrent(tx:Tx,principal:PlatformPrincipal):Promise<void>;
 assertSourceCurrent(tx:Tx,manifest:Manifest):Promise<void>;
 readSourceTimeWindow(tx:Tx,manifest:Manifest):Promise<unknown>;
 assertIssuerQualified(tx:Tx,manifest:Manifest):Promise<void>;
 assertSourceCredentialCurrent(tx:Tx,manifest:Manifest,metadata:{leaseRef:string;profileDigest:string;expiresAt:number}):Promise<void>;
 assertTransportQualified(tx:Tx,manifest:Manifest):Promise<void>;
 /** Last combined current-profile/generation check after ALL snapshot awaits.
  * Must cover applicable source/issuer/transport facts against this exact
  * captured owner/window. It is not another clock decision or new grant. */
 assertFinalCurrent(tx:Tx,state:OperationalDelegation,phase:'source'|'role'|'ecs',snapshot:OperationalOwnerSnapshot):Promise<void>;
}
type Identity=Partial<Pick<ReturnType<typeof createOperationalWorkloadIdentity>,'readConsumedTimeWindow'>>;
const stamp=z.number().int().nonnegative().safe(),digest=z.string().regex(/^[a-f0-9]{64}$/);
const sourceWindow=z.object({manifestDigest:digest,sourceEvidenceId:z.string().regex(/^platform_evidence_[a-f0-9-]{36}$/),profileDigest:digest,notBefore:stamp,expiresAt:stamp}).strict();
const jwtWindow=z.object({notBefore:stamp,expiresAt:stamp}).strict();
export interface OperationalOwnerSnapshot{
 readonly source:Readonly<z.infer<typeof sourceWindow>>;
 readonly jwt:Readonly<z.infer<typeof jwtWindow>>;
 readonly requester:Readonly<{notBefore:number;expiresAt:number}>;
 readonly reviewer:Readonly<{notBefore:number;expiresAt:number}>;
 readonly window:Readonly<{notBefore:number;expiresAt:number}>;
}
const fail=():never=>{throw Error('operational_joined_owner_unavailable')};
const same=(a:unknown,b:unknown)=>sha256ContentHash(a)===sha256ContentHash(b);
function freezeMetadata<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeMetadata(child);Object.freeze(value)}return value}
/** Runs ONLY inside the original delegation owner's already locked transaction.
 * It does not claim/reserve/issue, create another transaction, sample a later
 * independent clock or restore any consumed intent/credential/send proof. */
export function createWorkloadOwnerTime(raw:OperationalExecutionFacts|undefined,identity:Identity,timing:EcsDecisionTiming|undefined,assertHeld:(tx:Tx,state:OperationalDelegation)=>Promise<void>){
 const facts=raw&&Object.freeze({assertHumanCurrent:raw.assertHumanCurrent?.bind(raw),assertSourceCurrent:raw.assertSourceCurrent?.bind(raw),readSourceTimeWindow:raw.readSourceTimeWindow?.bind(raw),assertIssuerQualified:raw.assertIssuerQualified?.bind(raw),assertSourceCredentialCurrent:raw.assertSourceCredentialCurrent?.bind(raw),assertTransportQualified:raw.assertTransportQualified?.bind(raw),assertFinalCurrent:raw.assertFinalCurrent?.bind(raw)}),readJwt=identity.readConsumedTimeWindow?.bind(identity),clock=timing?.clock,signal=timing?.signal;
 return async(tx:Tx,rawState:OperationalDelegation,consumed:object,phase:'source'|'role'|'ecs',nativeCheck?:ExecutionTimeCheck,finalNativeFacts?:()=>Promise<void>)=>{
  try{
   if(!facts||Object.values(facts).some(fn=>typeof fn!=='function')||typeof readJwt!=='function'||typeof clock!=='function'||!(signal instanceof AbortSignal)||nativeCheck!==undefined&&typeof finalNativeFacts!=='function')return fail();
   const state=freezeMetadata(readOperationalDelegation(rawState));
   const active=()=>{signal.throwIfAborted();timing?.assertActive?.();signal.throwIfAborted()};active();
   if(!state.manifest.issuerProfileDigest||state.status!=='claimed'||!state.executionPrincipal||!state.targetReservation)return fail();
   if(phase==='source'&&(state.credential.status!=='pending'||state.sourceCredential?.status!=='pending')||phase==='role'&&(state.credential.status!=='pending'||state.sourceCredential?.status!=='issued')||phase==='ecs'&&(state.credential.status!=='issued'||state.sourceCredential?.status!=='issued'))return fail();
   const binding=Object.freeze({actionId:state.actionId,manifestDigest:state.manifest.digest,workload:state.manifest.workload,expiresAt:state.manifest.expiresAt});
   async function current(){
    active();const parent=readPlatformAction(await tx.read(state.actionId));active();
    if(parent.status!=='claimed'||parent.attemptCount!==1||parent.plan.digest!==state.parentPlanDigest||parent.plan.sourceDigest!==state.manifest.digest||parent.plan.expiresAt!==state.manifest.expiresAt||!same(parent.requester,state.requester)||!same(parent.reviewer,state.reviewer))return fail();
    await facts!.assertHumanCurrent!(tx,state.requester);await facts!.assertHumanCurrent!(tx,state.reviewer);await facts!.assertSourceCurrent!(tx,state.manifest);await facts!.assertIssuerQualified!(tx,state.manifest);active();
    await assertHeld(tx,state);active();
    if(state.sourceCredential?.status==='issued'){const source=state.sourceCredential;if(source.profileDigest!==state.manifest.issuerProfileDigest)return fail();await facts!.assertSourceCredentialCurrent!(tx,state.manifest,{leaseRef:source.leaseRef,profileDigest:source.profileDigest,expiresAt:source.expiresAt});active()}
    if(phase==='ecs'){await facts!.assertTransportQualified!(tx,state.manifest);active();if(await tx.readEffect(state.actionId,0)!=='claimed')return fail()}
    await facts!.assertHumanCurrent!(tx,state.requester);await facts!.assertHumanCurrent!(tx,state.reviewer);active();
    const now=await tx.now();active();if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(state.manifest.expiresAt))return fail();
   }
   async function capture(){
    active();const source=Object.freeze(sourceWindow.parse(await facts!.readSourceTimeWindow!(tx,state.manifest)));active();
    if(source.manifestDigest!==state.manifest.digest||source.sourceEvidenceId!==state.manifest.sourceEvidenceId||source.profileDigest!==state.manifest.issuerProfileDigest||source.notBefore>=source.expiresAt)return fail();
    const jwt=Object.freeze(jwtWindow.parse(await readJwt!(tx,consumed,binding)));active();
    if(jwt.notBefore>=jwt.expiresAt||jwt.expiresAt!==state.executionPrincipal!.expiresAt)return fail();
    const requester=await readPlatformPrincipalTimeWindow(tx,state.requester,signal!),reviewer=await readPlatformPrincipalTimeWindow(tx,state.reviewer,signal!);active();
    const window=Object.freeze({notBefore:Math.max(state.createdAt,source.notBefore,jwt.notBefore,requester.notBefore,reviewer.notBefore),expiresAt:Math.min(Date.parse(state.manifest.expiresAt),source.expiresAt,jwt.expiresAt,requester.expiresAt,reviewer.expiresAt,state.sourceCredential?.status==='issued'?state.sourceCredential.expiresAt:Number.MAX_SAFE_INTEGER,state.credential.status==='issued'?state.credential.expiresAt:Number.MAX_SAFE_INTEGER)});
    if(window.notBefore>=window.expiresAt)return fail();return Object.freeze({source,jwt,requester,reviewer,window});
   }
   await current();const before=await capture();
   if(nativeCheck)await nativeCheck(before.window);else await assertExecutionWindow(clock,before.window,signal);
   active();await current();const after=await capture();if(!same(before,after))return fail();
   await facts.assertFinalCurrent!(tx,state,phase,before);active();
   // Last native facts remain INSIDE this original transaction, after all
   // owner awaits; the caller must require its commit acknowledgment.
   if(nativeCheck)await finalNativeFacts!();active();
  }catch{return fail()}
 };
}
