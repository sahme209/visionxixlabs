import 'server-only';
import {assertPlatformParticipantsTime,readPlatformPrincipalTimeWindow} from '../principalTime';
import type {ExecutionTimeSource,ExecutionTimeCheck} from '../executionTime';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import {platformPreparationRequestId} from '../preparationContract';
import {manualReleaseSelection} from './manualReleaseClientContract';
export {manualReleaseSelection} from './manualReleaseClientContract';
import {compileOperationalManifest,readOperationalManifest} from './kernel';
const evidenceWindow=z.object({notBefore:z.number().int().nonnegative().safe(),expiresAt:z.number().int().nonnegative().safe()}).strict();
const recordId=z.string().regex(/^platform_manual_release_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
const recordSchema=z.object({id:recordId,selection:manualReleaseSelection,manifest:z.unknown(),requester:platformPrincipalSchema,reviewer:platformPrincipalSchema.nullable(),status:z.enum(['proposed','reviewed','notice_claimed','notice_recorded']),version:z.number().int().min(0).max(3),attemptCount:z.number().int().min(0).max(1),createdAt:z.number().int().nonnegative().safe(),updatedAt:z.number().int().nonnegative().safe()}).strict();
const fail=():never=>{throw Error('manual_release_unavailable')};
export function readManualReleaseRecord(raw:unknown){
 const value=recordSchema.parse(raw),manifest=readOperationalManifest(value.manifest);
 if(manifest.kind!=='release.manual')return fail();
 const versions={proposed:0,reviewed:1,notice_claimed:2,notice_recorded:3};
 if(value.version!==versions[value.status]||value.updatedAt<value.createdAt||value.createdAt>=Date.parse(manifest.expiresAt)||Date.parse(manifest.expiresAt)!==Date.parse(value.selection.expiresAt)||value.attemptCount!==(['notice_claimed','notice_recorded'].includes(value.status)?1:0)||value.status==='proposed'&&value.reviewer!==null||value.status!=='proposed'&&(!value.reviewer||value.reviewer.userId===value.requester.userId))fail();
 return Object.freeze({...value,manifest});
}
export type ManualReleaseRecord=ReturnType<typeof readManualReleaseRecord>;
export interface ManualReleaseTransaction{
 readSessionPrincipal(sessionId:string):Promise<unknown>;readPrincipal(principal:PlatformPrincipal):Promise<unknown>;
 lock(id:string):Promise<void>;now():Promise<number>;read(id:string):Promise<unknown|null>;
 insert(id:string,state:ManualReleaseRecord):Promise<void>;
 replace(id:string,version:number,state:ManualReleaseRecord):Promise<void>;
 event(event:{recordId:string;kind:'proposed'|'reviewed'|'notice_claimed'|'notice_recorded';state:ManualReleaseRecord}):Promise<void>;
}
export interface ManualReleaseRepository{transaction<T>(fn:(tx:ManualReleaseTransaction)=>Promise<T>):Promise<T>}
export interface ManualReleaseAuthority{assertCurrent(tx:ManualReleaseTransaction,principal:PlatformPrincipal):Promise<void>}
export interface ManualReleaseSource{
 /** Private server supplier, not caller JSON or a source/CI green boolean.
  * Default qualification must remain unavailable until actual sources qualify. */
 buildCurrentManifest(tx:ManualReleaseTransaction,selection:z.infer<typeof manualReleaseSelection>):Promise<unknown>;
 assertCurrent(tx:ManualReleaseTransaction,manifest:ManualReleaseRecord['manifest'],selection:z.infer<typeof manualReleaseSelection>):Promise<void>;
 /** Exact currently qualified source-evidence validity; not caller JSON. */
 readTimeWindow(tx:ManualReleaseTransaction,manifest:ManualReleaseRecord['manifest'],selection:z.infer<typeof manualReleaseSelection>):Promise<Readonly<{notBefore:number;expiresAt:number}>>;
}
function reference(raw:string,principal:PlatformPrincipal){const requestId=platformPreparationRequestId.parse(raw).toLowerCase(),hex=sha256ContentHash({purpose:'manual_release_preparation_v1',principal,requestId});return 'platform_manual_release_'+hex.slice(0,8)+'-'+hex.slice(8,12)+'-8'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32)}
/** Notice storage only. No token, provider transport, owner identity supplier,
 * workflow dispatch, secret or deployment function is accepted by this service. */
export function createManualReleaseStore(repo:ManualReleaseRepository,authority:ManualReleaseAuthority,source:ManualReleaseSource,timing?:{clock:ExecutionTimeSource;signal?:AbortSignal}){
 const clock=timing?.clock,signal=timing?.signal;
 function active(){if(typeof clock!=='function'||!(signal instanceof AbortSignal))return fail();signal.throwIfAborted();return signal}
 async function load(tx:ManualReleaseTransaction,id:string){const state=readManualReleaseRecord(await tx.read(id));if(state.id!==id)fail();return state}
 async function sourceCurrent(tx:ManualReleaseTransaction,state:ManualReleaseRecord){
  await authority.assertCurrent(tx,state.requester);if(state.reviewer)await authority.assertCurrent(tx,state.reviewer);
  await source.assertCurrent(tx,state.manifest,state.selection);
  await authority.assertCurrent(tx,state.requester);if(state.reviewer)await authority.assertCurrent(tx,state.reviewer);
  const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(state.manifest.expiresAt))fail();return now;
 }
 async function current(tx:ManualReleaseTransaction,state:ManualReleaseRecord,phaseActor?:PlatformPrincipal){
  const scope=active();if(phaseActor)await authority.assertCurrent(tx,phaseActor);await sourceCurrent(tx,state);
  const evidence=evidenceWindow.parse(await source.readTimeWindow(tx,state.manifest,state.selection));if(evidence.notBefore>=evidence.expiresAt)return fail();
  const actors=[state.requester,...(state.reviewer?[state.reviewer]:[]),...(phaseActor?[phaseActor]:[])];
  await assertPlatformParticipantsTime(tx,actors,clock!,{notBefore:evidence.notBefore,expiresAt:Math.min(Date.parse(state.manifest.expiresAt),evidence.expiresAt)},scope);
  const before=await sourceCurrent(tx,state);if(phaseActor)await authority.assertCurrent(tx,phaseActor);const now=await tx.now();if(!Number.isSafeInteger(now)||now<before||now>=Date.parse(state.manifest.expiresAt))return fail();const after=evidenceWindow.parse(await source.readTimeWindow(tx,state.manifest,state.selection));scope.throwIfAborted();if(after.notBefore!==evidence.notBefore||after.expiresAt!==evidence.expiresAt)return fail();return now;
 }
 async function locked<T>(raw:string,fn:(tx:ManualReleaseTransaction,state:ManualReleaseRecord)=>Promise<T>){const id=recordId.parse(raw);return repo.transaction(async tx=>{await tx.lock(id);return fn(tx,await load(tx,id))})}
 const api={
  async prepare(raw:unknown,principal:PlatformPrincipal,requestId:string){
   const actor=platformPrincipalSchema.parse(principal),selection=manualReleaseSelection.parse(raw),id=reference(requestId,actor);
   return repo.transaction(async tx=>{await tx.lock(id);await authority.assertCurrent(tx,actor);const existing=await tx.read(id);
    if(existing){const state=readManualReleaseRecord(existing);if(state.id!==id||state.requester.userId!==actor.userId||state.requester.sessionId!==actor.sessionId||sha256ContentHash({...state.selection,expiresAt:new Date(state.selection.expiresAt).toISOString()})!==sha256ContentHash({...selection,expiresAt:new Date(selection.expiresAt).toISOString()}))fail();await authority.assertCurrent(tx,actor);return {recordId:id,historical:true as const,authority:'notice_reference_only' as const}}
    active();const manifest=compileOperationalManifest(await source.buildCurrentManifest(tx,selection));if(manifest.kind!=='release.manual'||Date.parse(manifest.expiresAt)!==Date.parse(selection.expiresAt))fail();
    const now=await tx.now(),state=readManualReleaseRecord({id,selection,manifest,requester:actor,reviewer:null,status:'proposed',version:0,attemptCount:0,createdAt:now,updatedAt:now});
    await current(tx,state);await tx.insert(id,state);await tx.event({recordId:id,kind:'proposed',state});await current(tx,state);
    return {recordId:id,historical:false as const,authority:'notice_reference_only' as const};
   });
  },
  async lookup(requestId:string,principal:PlatformPrincipal){const actor=platformPrincipalSchema.parse(principal),id=reference(requestId,actor);return repo.transaction(async tx=>{await tx.lock(id);await authority.assertCurrent(tx,actor);const raw=await tx.read(id);if(raw){const state=readManualReleaseRecord(raw);if(state.id!==id||state.requester.userId!==actor.userId||state.requester.sessionId!==actor.sessionId)fail()}await authority.assertCurrent(tx,actor);return raw?{found:true as const,recordId:id,authority:'history_only' as const}:{found:false as const,authority:'history_only' as const}})},
  async inspect(id:string,principal:PlatformPrincipal){const actor=platformPrincipalSchema.parse(principal);return locked(id,async(tx,state)=>{
   await authority.assertCurrent(tx,actor);const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt)fail();await authority.assertCurrent(tx,actor);
   return Object.freeze({recordId:state.id,manifest:state.manifest,inspectedAt:now,status:state.status,version:state.version,attemptCount:state.attemptCount,requesterUserId:state.requester.userId,reviewerUserId:state.reviewer?.userId??null,expired:now>=Date.parse(state.manifest.expiresAt),ownerAuthorization:'external_not_verified' as const,providerExecution:false as const,authority:'history_only' as const,sourceValidation:'not_checked' as const});
  })},
  async review(id:string,version:number,digest:string,principal:PlatformPrincipal){const actor=platformPrincipalSchema.parse(principal);await locked(id,async(tx,state)=>{
   if(state.status!=='proposed'||state.version!==version||state.manifest.digest!==digest||actor.userId===state.requester.userId)fail();await authority.assertCurrent(tx,actor);const now=await current(tx,state,actor);
   const next=readManualReleaseRecord({...state,reviewer:actor,status:'reviewed',version:1,updatedAt:now});await tx.replace(id,version,next);await tx.event({recordId:id,kind:'reviewed',state:next});await current(tx,next);
  })},
  /** Private fresh-observation authorization. Historical review expiry never
   * grants new execution, and does not replace the actual current reader. */
  async authorizeObservation(expected:{recordId:string;manifest:{digest:string};status:string;version:number;inspectedAt:number},principal:PlatformPrincipal,check:ExecutionTimeCheck,observationSignal:AbortSignal){
   const actor=platformPrincipalSchema.parse(principal),scope=AbortSignal.any([active(),observationSignal]);scope.throwIfAborted();if(typeof check!=='function')return fail();
   await locked(expected.recordId,async(tx,state)=>{
    if(!['notice_claimed','notice_recorded'].includes(state.status)||state.status!==expected.status||state.version!==expected.version||state.manifest.digest!==expected.manifest.digest)return fail();
    await authority.assertCurrent(tx,actor);const window=await readPlatformPrincipalTimeWindow(tx,actor,scope);await check(window);scope.throwIfAborted();await authority.assertCurrent(tx,actor);
    const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||now<expected.inspectedAt)return fail();await authority.assertCurrent(tx,actor);scope.throwIfAborted();
   });scope.throwIfAborted();
  },
  async recordNotice(id:string,version:number,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal);
   try{
    await locked(id,async(tx,state)=>{if(state.status!=='reviewed'||state.version!==version||actor.userId!==state.requester.userId||actor.sessionId!==state.requester.sessionId)fail();const now=await current(tx,state),next=readManualReleaseRecord({...state,status:'notice_claimed',version:2,attemptCount:1,updatedAt:now});await tx.replace(id,version,next);await tx.event({recordId:id,kind:'notice_claimed',state:next});await current(tx,next)});
    // Only a confirmed claim commit advances this invocation. No public finish,
    // retry or reset method can reconstruct it after an uncertain claim/result.
    await locked(id,async(tx,state)=>{if(state.status!=='notice_claimed'||state.version!==2||actor.userId!==state.requester.userId||actor.sessionId!==state.requester.sessionId)fail();const now=await current(tx,state),next=readManualReleaseRecord({...state,status:'notice_recorded',version:3,updatedAt:now});await tx.replace(id,2,next);await tx.event({recordId:id,kind:'notice_recorded',state:next});await current(tx,next)});
   }catch{throw Error('manual_release_notice_unconfirmed')}
   return api.inspect(id,actor);
  },
 };
 return Object.freeze(api);
}
