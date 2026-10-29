import 'server-only';
import {ticketReviewScopeSchema,serviceNowTerminalPolicySchema,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {serviceNowTicketCredentialSchema,collectServiceNowTerminalTransitions} from '@/lib/releaseops/serviceNowTicketTransport';
import {untilAbort,readBoundedJiraJson} from '@/lib/releaseops/jiraTicketTransport';
import {serviceNowCloseMetadataSchema,type ServiceNowTrustedCloseMetadata} from './serviceNowTicketLifecyclePreparation';
import type {ServiceNowCredentialPort} from './serviceNowTicketCredential';
export interface GovernedServiceNowClosePorts {
 readApprovedPolicy?:(scope:TicketReviewScope,reviewId:string,signal:AbortSignal)=>Promise<unknown>;
 readCredential?:ServiceNowCredentialPort;
 assertCurrent?:(scope:TicketReviewScope,signal:AbortSignal)=>Promise<void>;
}
const proofSchema=z.object({kind:z.literal('verified_ticket_governance_review_v1'),reviewId:z.string().regex(/^ticket_review_[a-f0-9]{64}$/),bindingDigest:z.string().regex(/^[a-f0-9]{64}$/),approverUserId:z.string().min(1),binding:serviceNowTerminalPolicySchema}).strict();
/** Read-only policy projection. The injected port must revalidate the durable review and current authority. */
export function createGovernedServiceNowCloseReader(ports:GovernedServiceNowClosePorts={},options:{fetch?:typeof fetch;now?:()=>number}={}){
 return async(rawScope:TicketReviewScope,reviewId:string,rawIssue:{sysId:string;number:string},parent:AbortSignal):Promise<ServiceNowTrustedCloseMetadata>=>{
  if(!ports.readApprovedPolicy||!ports.readCredential||!ports.assertCurrent)throw Error('servicenow_governed_close_unavailable');
  const scope=ticketReviewScopeSchema.parse(rawScope),issue=z.object({sysId:z.string().regex(/^[a-f0-9]{32}$/),number:z.string().regex(/^CHG[0-9]{1,20}$/)}).strict().parse(rawIssue);
  const now=options.now??Date.now,signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);
  const current=async()=>{signal.throwIfAborted();await untilAbort(ports.assertCurrent!(scope,signal),signal);signal.throwIfAborted()};
  const readProof=async()=>{
   await current();const p=proofSchema.parse(await untilAbort(ports.readApprovedPolicy!(scope,reviewId,signal),signal));
   if(p.reviewId!==reviewId||p.binding.organizationId!==scope.organizationId||p.bindingDigest!==sha256ContentHash(p.binding)||[p.binding.requesterUserId,p.binding.executorUserId].includes(p.approverUserId)||Date.parse(p.binding.expiresAt)<=now())throw Error('servicenow_terminal_policy_changed');
   return p;
  };
  const proof=await readProof(),policy=proof.binding;
  const auth=serviceNowTicketCredentialSchema.parse(await untilAbort(ports.readCredential(scope,policy,signal),signal));
  if(auth.organizationId!==scope.organizationId||auth.connectionId!==policy.connectionId||auth.connectionRevision!==policy.connectionRevision||auth.instanceOrigin!==policy.instanceOrigin||!auth.permissions.read||auth.expiresAt<=now()+15000)throw Error('servicenow_scoped_credential_unavailable');
  await current();
  const response=await untilAbort((options.fetch??fetch)(policy.instanceOrigin+'/api/sn_chg_rest/v1/change/'+issue.sysId+'/nextstates',{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${auth.accessToken}`},signal,redirect:'error',cache:'no-store',credentials:'omit'}),signal,r=>{void r.body?.cancel().catch(()=>{})});
  if(response.status!==200||response.redirected||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'){void response.body?.cancel().catch(()=>{});throw Error('servicenow_native_transition_unavailable')}
  const rawNextStates=await readBoundedJiraJson(response,signal);
  const native=z.object({result:z.object({available_states:z.array(z.string()).max(100),state_label:z.record(z.string(),z.string().min(1).max(240))})}).parse(rawNextStates).result;
  collectServiceNowTerminalTransitions(rawNextStates,policy.terminalStates.map(s=>s.value));
  for(const state of policy.terminalStates)if(native.available_states.includes(state.value)&&native.state_label[state.value]!==state.label)throw Error('servicenow_terminal_policy_changed');
  const refreshed=await readProof();if(sha256ContentHash(refreshed)!==sha256ContentHash(proof))throw Error('servicenow_terminal_policy_changed');
  await current();const observed=now(),expires=Math.min(observed+60000,Date.parse(policy.expiresAt),auth.expiresAt);
  if(expires<=observed)throw Error('servicenow_terminal_policy_expired');
  return serviceNowCloseMetadataSchema.parse({organizationId:scope.organizationId,connectionId:policy.connectionId,connectionRevision:policy.connectionRevision,instanceOrigin:policy.instanceOrigin,issue,nativeProcess:policy.nativeProcess,schemaDigest:sha256ContentHash({reviewId,bindingDigest:proof.bindingDigest,nativeProcess:policy.nativeProcess,fields:policy.fields}),observedAt:new Date(observed).toISOString(),expiresAt:new Date(expires).toISOString(),rawNextStates,verifiedTerminalStateValues:policy.terminalStates.map(s=>s.value),fields:policy.fields,targetStateLabels:Object.fromEntries(policy.terminalStates.map(s=>[s.value,s.label]))});
 };
}
