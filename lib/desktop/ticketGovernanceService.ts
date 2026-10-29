import 'server-only';
import {z} from 'zod';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createTicketGovernanceReviewStore,type TicketReviewPorts} from '@/lib/releaseops/ticketGovernanceReviewStore';
import {ticketGovernanceBindingSchema,ticketReviewScopeSchema,TICKET_GOVERNANCE_REVIEW_KIND,type TicketReviewScope,type TicketGovernanceBinding} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {createTicketAssociationLockedSource,type TicketAssociationSourcePorts} from './ticketGovernanceSource';
import {createServiceNowTerminalPolicyLockedSource} from './serviceNowTerminalPolicySource';
import {createTicketPreflightCache} from './ticketPreflightCache';
import {createTicketModelPreflightCache} from './ticketModelPreflightCache';
type TicketCachePorts=NonNullable<Parameters<typeof createTicketPreflightCache>[0]>;
type ModelCachePorts=NonNullable<Parameters<typeof createTicketModelPreflightCache>[0]>;
/** One service per authenticated HTTP request. All provider I/O finishes before
 * the store takes locks; store authority/source rechecks remain mandatory. */
export function createTicketGovernanceService(repo:ReleaseOperationPlanRepo,ports:{
 assertCurrent:NonNullable<TicketReviewPorts['assertCurrent']>;
 assertPreflightAuthority:(scope:TicketReviewScope,binding:TicketGovernanceBinding,signal:AbortSignal)=>Promise<void>;
 associationSource:Omit<TicketAssociationSourcePorts,'readTicketReceipt'>;
 readOriginalCandidate:(scope:TicketReviewScope,binding:Extract<TicketGovernanceBinding,{kind:'ticket_release_association'}>,signal:AbortSignal)=>Promise<unknown>;
 readTicket:NonNullable<TicketCachePorts['readTicket']>;
 readModel:NonNullable<ModelCachePorts['readModel']>;
 now?:()=>number;
}){
 const ticket=createTicketPreflightCache({readTicket:ports.readTicket,now:ports.now}),model=createTicketModelPreflightCache({readModel:ports.readModel,now:ports.now});
 const source=createTicketAssociationLockedSource({...ports.associationSource,readTicketReceipt:ticket.readTicketReceipt,now:ports.now}),policySource=createServiceNowTerminalPolicyLockedSource({readModelReceipt:model.read,now:ports.now});
 const store=createTicketGovernanceReviewStore(repo,{assertCurrent:ports.assertCurrent,now:ports.now?()=>new Date(ports.now!()):undefined,readCurrentBinding:(tx,scope,binding)=>binding.kind==='ticket_release_association'?source(tx,scope,binding):policySource(tx,scope,binding)});
 async function warm(rawScope:TicketReviewScope,rawBinding:unknown,parent:AbortSignal){
  const scope=ticketReviewScopeSchema.parse(rawScope),binding=ticketGovernanceBindingSchema.parse(rawBinding),signal=AbortSignal.any([parent,AbortSignal.timeout(20000)]);
  signal.throwIfAborted();if(scope.organizationId!==binding.organizationId)throw Error('ticket_review_scope_changed');await ports.assertPreflightAuthority(scope,binding,signal);
  if(binding.kind==='ticket_release_association'){const candidate=await ports.readOriginalCandidate(scope,binding,signal);await ticket.warmTicket(scope,binding.ticket,candidate,signal)}else await model.warm(scope,binding,signal);
  signal.throwIfAborted();await ports.assertPreflightAuthority(scope,binding,signal);signal.throwIfAborted();return{scope,binding};
 }
 async function existing(scope:TicketReviewScope,id:string,signal:AbortSignal){
  if(!/^ticket_review_[a-f0-9]{64}$/.test(id))throw Error('ticket_review_unavailable');ticketReviewScopeSchema.parse(scope);signal.throwIfAborted();
  // Unlocked persisted binding is solely a preflight hint, never approval proof.
  // Store get/approve reloads and verifies full event/source history under locks.
  const row=await repo.durableAgentWorkflow.findFirst({where:{id,organizationId:scope.organizationId,workflowKind:TICKET_GOVERNANCE_REVIEW_KIND}});
  if(!row||row.id!==id||row.organizationId!==scope.organizationId||row.workflowKind!==TICKET_GOVERNANCE_REVIEW_KIND)throw Error('ticket_review_unavailable');
  const hint=z.object({binding:ticketGovernanceBindingSchema}).passthrough().parse(row.inputJson);return warm(scope,hint.binding,signal);
 }
 return{
  async prepare(scope:TicketReviewScope,binding:unknown,clientRequestId:string,signal:AbortSignal){const fresh=await warm(scope,binding,signal);return store.prepare(fresh.scope,fresh.binding,clientRequestId)},
  async get(scope:TicketReviewScope,id:string,signal:AbortSignal){signal.throwIfAborted();await store.readHistory(scope,id);try{await existing(scope,id,signal)}catch{signal.throwIfAborted();return store.readHistory(scope,id)}return store.get(scope,id)},
  async approve(scope:TicketReviewScope,input:{id:string;expectedVersion:number;clientRequestId:string},signal:AbortSignal){await existing(scope,input.id,signal);return store.approve(scope,input)},
  // Cancellation/revocation must remain possible when provider preflight fails.
  async cancel(scope:TicketReviewScope,input:{id:string;expectedVersion:number;clientRequestId:string},signal:AbortSignal){signal.throwIfAborted();return store.cancel(scope,input)},
 };
}
