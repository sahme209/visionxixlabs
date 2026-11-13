import 'server-only';

export interface ExecutionTimeInterval {readonly earliest:number;readonly latest:number}
/** Private composition port, never request JSON or a default clock. Its native
 * origin/profile, current-use validity and time scale need real qualification;
 * structural validation here does not establish any of those guarantees. */
export type ExecutionTimeSource=(signal:AbortSignal)=>Promise<ExecutionTimeInterval>;
export type ExecutionTimeCheck=()=>Promise<void>;
export type ExecutionTimeAuthorization=(timeCheck?:ExecutionTimeCheck)=>Promise<void>;
const fail=():never=>{throw Error('platform_execution_time_unavailable')};
const stamp=(value:number)=>Number.isSafeInteger(value)&&value>=0;

/** Read afresh at each decision, including after awaited authority checks.
 * No caching, tolerance, drift extrapolation or process/database-clock fallback.
 * Audit ordering remains the transaction's separate existing responsibility. */
export async function assertExecutionWindow(source:ExecutionTimeSource,window:{readonly notBefore?:number;readonly expiresAt?:number},signal:AbortSignal):Promise<Readonly<ExecutionTimeInterval>>{
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
export async function authorizeExecutionWindow(source:ExecutionTimeSource,window:{readonly notBefore?:number;readonly expiresAt?:number},authorize:ExecutionTimeAuthorization,signal:AbortSignal):Promise<void>{
 const captured=Object.freeze({notBefore:window.notBefore,expiresAt:window.expiresAt});
 let active=true,started=false,completed=false,invalid=false;
 const check=async()=>{
  if(!active||started){invalid=true;return fail()}started=true;
  try{await assertExecutionWindow(source,captured,signal);signal.throwIfAborted();if(!active)return fail();completed=true}catch{invalid=true;return fail()}
 };
 try{signal.throwIfAborted();await authorize(check);signal.throwIfAborted();if(!completed||invalid)return fail()}catch{invalid=true;return fail()}finally{active=false}
}
