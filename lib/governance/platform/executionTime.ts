import 'server-only';

export interface ExecutionTimeInterval {readonly earliest:number;readonly latest:number}
/** Private composition port, never request JSON or a default clock. Its native
 * origin/profile, current-use validity and time scale need real qualification;
 * structural validation here does not establish any of those guarantees. */
export type ExecutionTimeSource=(signal:AbortSignal)=>Promise<ExecutionTimeInterval>;
export interface ExecutionTimeWindow {readonly notBefore?:number;readonly expiresAt?:number}
/** Locked authorization owners may add restrictions, never replace native bounds. */
export type ExecutionTimeCheck=(restriction?:ExecutionTimeWindow)=>Promise<void>;
/** Optional native facts are read-only and must run after the original owner's
 * final awaited source/people/order checks, inside that SAME transaction. No
 * post-commit clock read. Transports requiring this hook verify completion. */
export type ExecutionTimeAuthorization=(timeCheck?:ExecutionTimeCheck,finalNativeFacts?:()=>Promise<void>)=>Promise<void>;
const fail=():never=>{throw Error('platform_execution_time_unavailable')};
const stamp=(value:number)=>Number.isSafeInteger(value)&&value>=0;

/** Read afresh at each decision, including after awaited authority checks.
 * No caching, tolerance, drift extrapolation or process/database-clock fallback.
 * Audit ordering remains the transaction's separate existing responsibility. */
export async function assertExecutionWindow(source:ExecutionTimeSource,window:ExecutionTimeWindow,signal:AbortSignal):Promise<Readonly<ExecutionTimeInterval>>{
 try{
  signal.throwIfAborted();
  const notBefore=window.notBefore,expiresAt=window.expiresAt;
  if(typeof source!=='function'||notBefore!==undefined&&!stamp(notBefore)||expiresAt!==undefined&&!stamp(expiresAt))return fail();
  const raw=await source(signal);signal.throwIfAborted();
  const earliest=raw.earliest,latest=raw.latest;
  if(!stamp(earliest)||!stamp(latest)||latest<earliest||notBefore!==undefined&&earliest<notBefore||expiresAt!==undefined&&latest>=expiresAt)return fail();
  return Object.freeze({earliest,latest});
 }catch{return fail()}
}

/** The actual authorization owner must await this check inside its existing
 * locked transaction and recheck authority afterwards. No new clock I/O occurs
 * after commit acknowledgement. Native validity through dispatch remains a
 * separate qualification requirement, not established by this acknowledgement. */
async function acknowledgedExecutionWindow(source:ExecutionTimeSource,window:ExecutionTimeWindow,authorize:ExecutionTimeAuthorization,signal:AbortSignal,requiredFinalFacts?:()=>Promise<void>):Promise<Readonly<ExecutionTimeWindow>>{
 const captured=Object.freeze({notBefore:window.notBefore,expiresAt:window.expiresAt});
 let active=true,started=false,completed=false,invalid=false,finalStarted=false,finalCompleted=false;
 let acceptedWindow:Readonly<ExecutionTimeWindow>|undefined;
 const check:ExecutionTimeCheck=async restriction=>{
  if(!active||started){invalid=true;return fail()}started=true;
  try{
   const notBefore=restriction?.notBefore,expiresAt=restriction?.expiresAt;
   if(notBefore!==undefined&&!stamp(notBefore)||expiresAt!==undefined&&!stamp(expiresAt))return fail();
   const joined=Object.freeze({notBefore:captured.notBefore===undefined?notBefore:notBefore===undefined?captured.notBefore:Math.max(captured.notBefore,notBefore),expiresAt:captured.expiresAt===undefined?expiresAt:expiresAt===undefined?captured.expiresAt:Math.min(captured.expiresAt,expiresAt)});
   await assertExecutionWindow(source,joined,signal);signal.throwIfAborted();if(!active)return fail();acceptedWindow=joined;completed=true}catch{invalid=true;return fail()}
 };
 const finalFacts=requiredFinalFacts===undefined?undefined:async()=>{
  try{if(!active||finalStarted||!completed)return fail();finalStarted=true;signal.throwIfAborted();await requiredFinalFacts();signal.throwIfAborted();if(!active)return fail();finalCompleted=true}catch{invalid=true;return fail()}
 };
 try{signal.throwIfAborted();if(captured.notBefore!==undefined&&!stamp(captured.notBefore)||captured.expiresAt!==undefined&&!stamp(captured.expiresAt))return fail();await authorize(check,finalFacts);signal.throwIfAborted();if(!completed||invalid||!acceptedWindow||requiredFinalFacts!==undefined&&!finalCompleted)return fail();return acceptedWindow}catch{invalid=true;return fail()}finally{active=false}
}


/** Authorization-only callers retain their original in-transaction contract. */
export async function authorizeExecutionWindow(source:ExecutionTimeSource,window:ExecutionTimeWindow,authorize:ExecutionTimeAuthorization,signal:AbortSignal,requiredFinalFacts?:()=>Promise<void>):Promise<void>{
 await acknowledgedExecutionWindow(source,window,authorize,signal,requiredFinalFacts);
}

declare const dispatchCheckpointBrand:unique symbol;
export type ExecutionDispatchCheckpoint=Readonly<{[dispatchCheckpointBrand]:true}>;
interface DispatchState{source:ExecutionTimeSource;window:Readonly<ExecutionTimeWindow>;signal:AbortSignal;binding:object;assertCurrent:()=>Promise<void>}
const dispatchCheckpoints=new WeakMap<object,Readonly<DispatchState>>();
/** Original authorization linearizes at acknowledged commit. This private
 * checkpoint is NOT new authorization and cannot renew an attempt or deadline.
 * Binding/callbacks must belong to the fixed private transport, never request
 * JSON or transaction-bound human/source authorizers. No native default exists. */
export async function prepareExecutionDispatch(source:ExecutionTimeSource,window:ExecutionTimeWindow,authorize:ExecutionTimeAuthorization,signal:AbortSignal,binding:object,assertDispatchCurrent:()=>Promise<void>,requiredFinalFacts?:()=>Promise<void>):Promise<ExecutionDispatchCheckpoint>{
 try{
  if(!binding||typeof binding!=='object'||!Object.isFrozen(binding)||typeof assertDispatchCurrent!=='function')return fail();
  const original=Object.freeze({source,signal,binding,assertCurrent:assertDispatchCurrent});
  const accepted=await acknowledgedExecutionWindow(source,window,authorize,signal,requiredFinalFacts);signal.throwIfAborted();
  const checkpoint=Object.freeze({}) as ExecutionDispatchCheckpoint;
  dispatchCheckpoints.set(checkpoint,Object.freeze({...original,window:accepted}));return checkpoint;
 }catch{return fail()}
}
/** Consume BEFORE awaiting. A refused or uncertain dispatch stays consumed.
 * Currentness is limited to the SAME sealed native/runtime/credential/request;
 * never reuse the original transaction or replace expired human authority.
 * This last check cannot prove provider receipt before expiry: ordinary
 * scheduling may pause after it. Provider-enforced deadlines need real proof. */
export async function consumeExecutionDispatch(checkpoint:ExecutionDispatchCheckpoint,binding:object):Promise<void>{
 try{
  if(!checkpoint||typeof checkpoint!=='object')return fail();
  const state=dispatchCheckpoints.get(checkpoint);dispatchCheckpoints.delete(checkpoint);
  if(!state||binding!==state.binding)return fail();state.signal.throwIfAborted();
  await assertExecutionWindow(state.source,state.window,state.signal);state.signal.throwIfAborted();
  await state.assertCurrent();state.signal.throwIfAborted();
 }catch{return fail()}
}
