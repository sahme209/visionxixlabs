import 'server-only';
import {serviceNowTerminalPolicyOptionsSchema,serviceNowTerminalPolicyRequestSchema} from '@/lib/releaseops/serviceNowTerminalPolicyRequest';
import {serviceNowTerminalPolicySchema,ticketReviewScopeSchema,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
export function createServiceNowTerminalPolicyProposal(ports:{assertAdministrator:(scope:TicketReviewScope,signal:AbortSignal)=>Promise<void>;readOptions:(scope:TicketReviewScope,signal:AbortSignal)=>Promise<unknown>;now?:()=>number}){
 return async(rawScope:TicketReviewScope,raw:unknown,parent:AbortSignal)=>{const scope=ticketReviewScopeSchema.parse(rawScope),input=serviceNowTerminalPolicyRequestSchema.parse(raw),signal=AbortSignal.any([parent,AbortSignal.timeout(20000)]),now=ports.now??Date.now;
  await ports.assertAdministrator(scope,signal);signal.throwIfAborted();const options=serviceNowTerminalPolicyOptionsSchema.parse(await withGithubAbort(ports.readOptions(scope,signal),signal));signal.throwIfAborted();const at=now(),model=options.models.find(m=>m.id===input.modelSysId);if(!model||!Number.isFinite(at)||Date.parse(options.expiresAt)<=at)throw Error('servicenow_model_changed');await ports.assertAdministrator(scope,signal);signal.throwIfAborted();
  return serviceNowTerminalPolicySchema.parse({kind:'servicenow_terminal_policy',organizationId:scope.organizationId,requesterUserId:scope.actorUserId,executorUserId:scope.actorUserId,expiresAt:new Date(at+900000).toISOString(),connectionId:options.connectionId,connectionRevision:options.connectionRevision,instanceOrigin:options.instanceOrigin,nativeProcess:{kind:'model',modelSysId:model.id,label:model.label},modelDigest:model.modelDigest,provenance:'administrator_declared',sourceReferences:input.sourceReferences,terminalStates:input.terminalStates,fields:input.fields});
 };
}
