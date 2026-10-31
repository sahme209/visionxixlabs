import 'server-only';
import type {GovernanceAdmissionContext,GovernanceAdmissionReceipt} from './admissionGuard';
interface Guard {
 assert(context:unknown,phase:'before_claim'|'before_write',prior?:GovernanceAdmissionReceipt,signal?:AbortSignal):Promise<GovernanceAdmissionReceipt>;
}
/** Local composition adapter, not a coverage registration. Existing stores own
 * durable claims, one-attempt limits, expiry and unknown-result recording.
 * A failed post-claim check must be recorded by that store, never retried here.
 * Callbacks must be trusted server closures, not model/request-supplied code. */
export function createGovernanceExecutionBoundary(guard:Guard){return{
 async run<T>(raw:GovernanceAdmissionContext,ports:{claim():Promise<{claimed:boolean}>;write(signal:AbortSignal):Promise<T>},parent?:AbortSignal):Promise<{claimed:false}|{claimed:true;result:T}>{
  const context=structuredClone(raw),signal=AbortSignal.any([...(parent?[parent]:[]),AbortSignal.timeout(15000)]);
  signal.throwIfAborted();
  const receipt=await guard.assert(context,'before_claim',undefined,signal);
  signal.throwIfAborted();
  const claim=await ports.claim();
  signal.throwIfAborted();
  if(claim.claimed!==true)return{claimed:false};
  await guard.assert(context,'before_write',receipt,signal);
  signal.throwIfAborted();
  return{claimed:true,result:await ports.write(signal)};
 }
}};
