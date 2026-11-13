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
export async function authorizeExecutionWindow(source:ExecutionTimeSource,window:ExecutionTimeWindow,authorize:ExecutionTimeAuthorization,signal:AbortSignal,requiredFinalFacts?:()=>Promise<void>):Promise<void>{
 const captured=Object.freeze({notBefore:window.notBefore,expiresAt:window.expiresAt});
 let active=true,started=false,completed=false,invalid=false,finalStarted=false,finalCompleted=false;
 const check:ExecutionTimeCheck=async restriction=>{
  if(!active||started){invalid=true;return fail()}started=true;
  try{
   const notBefore=restriction?.notBefore,expiresAt=restriction?.expiresAt;
   if(notBefore!==undefined&&!stamp(notBefore)||expiresAt!==undefined&&!stamp(expiresAt))return fail();
   const joined=Object.freeze({notBefore:captured.notBefore===undefined?notBefore:notBefore===undefined?captured.notBefore:Math.max(captured.notBefore,notBefore),expiresAt:captured.expiresAt===undefined?expiresAt:expiresAt===undefined?captured.expiresAt:Math.min(captured.expiresAt,expiresAt)});
   await assertExecutionWindow(source,joined,signal);signal.throwIfAborted();if(!active)return fail();completed=true}catch{invalid=true;return fail()}
 };
 const finalFacts=requiredFinalFacts===undefined?undefined:async()=>{
  try{if(!active||finalStarted||!completed)return fail();finalStarted=true;signal.throwIfAborted();await requiredFinalFacts();signal.throwIfAborted();if(!active)return fail();finalCompleted=true}catch{invalid=true;return fail()}
 };
 try{signal.throwIfAborted();if(captured.notBefore!==undefined&&!stamp(captured.notBefore)||captured.expiresAt!==undefined&&!stamp(captured.expiresAt))return fail();await authorize(check,finalFacts);signal.throwIfAborted();if(!completed||invalid||requiredFinalFacts!==undefined&&!finalCompleted)return fail()}catch{invalid=true;return fail()}finally{active=false}
}
