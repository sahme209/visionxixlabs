import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketReviewScopeSchema,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {releaseWorkflowEvidenceBindingSchema,type ReleaseWorkflowEvidenceBinding} from '@/lib/tauri/releaseWorkflowEvidenceContract';
import {createReleaseWorkflowObservationGithub,type ReleaseWorkflowObservationGithubDependencies} from '@/lib/tauri/releaseWorkflowObservationGithub';
export interface HistoricalTicketRunObservationPorts extends Pick<ReleaseWorkflowObservationGithubDependencies,'fetch'|'now'|'isEnabled'>{
 assertCurrent?:(scope:Readonly<TicketReviewScope>,binding:Readonly<ReleaseWorkflowEvidenceBinding>,signal:AbortSignal)=>Promise<void>;
 readCurrentHistoricalBinding?:(scope:Readonly<TicketReviewScope>,binding:Readonly<ReleaseWorkflowEvidenceBinding>,signal:AbortSignal)=>Promise<unknown>;
 readCredential?:(scope:Readonly<TicketReviewScope>,binding:Readonly<ReleaseWorkflowEvidenceBinding>,signal:AbortSignal)=>Promise<unknown>;
}
/** Fresh read lease only. The existing fixed-endpoint verifier is reused unchanged;
 * original binding/approval/operation rows and execution windows are never extended. */
export function createHistoricalTicketRunObservation(ports:HistoricalTicketRunObservationPorts={}){
 return async(rawScope:TicketReviewScope,rawBinding:ReleaseWorkflowEvidenceBinding,parent:AbortSignal)=>{
  if(!ports.isEnabled?.()||!ports.fetch||!ports.assertCurrent||!ports.readCurrentHistoricalBinding||!ports.readCredential)throw Error('historical_ticket_run_unavailable');
  const scope=Object.freeze(ticketReviewScopeSchema.parse(rawScope)),original=Object.freeze(releaseWorkflowEvidenceBindingSchema.parse(rawBinding)),now=ports.now??Date.now,digest=sha256ContentHash(original);
  if(original.organizationId!==scope.organizationId||!Number.isFinite(now()))throw Error('historical_ticket_run_unavailable');
  const lease=Object.freeze({...original,expiresAt:new Date(now()+60000).toISOString()});
  const current=async(signal:AbortSignal)=>{
   signal.throwIfAborted();if(!ports.isEnabled?.()||Date.parse(lease.expiresAt)<=now())throw Error('historical_ticket_run_unavailable');
   await ports.assertCurrent!(scope,original,signal);
   const trusted=releaseWorkflowEvidenceBindingSchema.parse(await ports.readCurrentHistoricalBinding!(scope,original,signal));
   if(sha256ContentHash(trusted)!==digest)throw Error('historical_ticket_run_changed');signal.throwIfAborted();
  };
  const observe=createReleaseWorkflowObservationGithub({fetch:ports.fetch,now,isEnabled:ports.isEnabled,assertCurrent:(_binding,signal)=>current(signal),readTrustedDispatchBinding:async(_binding,signal)=>{await current(signal);return lease},readCredential:async(_binding,signal)=>{await current(signal);return ports.readCredential!(scope,original,signal)}});
  const observation=await observe(lease,parent);if(!observation)throw Error('historical_ticket_run_unavailable');
  await current(parent);return{...observation,bindingDigest:digest};
 };
}
