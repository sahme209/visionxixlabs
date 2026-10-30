import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketGovernanceReferenceSchema,type TicketGovernanceReference} from '@/lib/releaseops/ticketGovernanceReference';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
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
 const store=createTicketGovernanceReviewStore(repo,{assertCurrent:ports.assertCurrent,now:ports.now?()=>new Date(ports.now!()):undefined,readCurrentBinding:(tx,scope,binding)=>binding.kind==='ticket_release_association'?source(tx,scope,binding):binding.kind==='servicenow_terminal_policy'?policySource(tx,scope,binding):Promise.reject(Error('ticket_observation_source_required'))});
 async function warm(rawScope:TicketReviewScope,rawBinding:unknown,parent:AbortSignal){
  const scope=ticketReviewScopeSchema.parse(rawScope),binding=ticketGovernanceBindingSchema.parse(rawBinding),signal=AbortSignal.any([parent,AbortSignal.timeout(20000)]);
  signal.throwIfAborted();if(scope.organizationId!==binding.organizationId)throw Error('ticket_review_scope_changed');await ports.assertPreflightAuthority(scope,binding,signal);
  if(binding.kind==='ticket_release_association'){const candidate=await ports.readOriginalCandidate(scope,binding,signal);await ticket.warmTicket(scope,binding.ticket,candidate,signal)}else if(binding.kind==='servicenow_terminal_policy')await model.warm(scope,binding,signal);else throw Error('ticket_observation_source_required');
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
 const approved=new Map<string,TicketGovernanceBinding>();
 const approvalKey=(scope:TicketReviewScope,reference:TicketGovernanceReference)=>sha256ContentHash({scope:ticketReviewScopeSchema.parse(scope),reference:ticketGovernanceReferenceSchema.parse(reference)});
 return{
  async preflightApproved(scope:TicketReviewScope,rawReference:TicketGovernanceReference,signal:AbortSignal){
   const reference=ticketGovernanceReferenceSchema.parse(rawReference),key=approvalKey(scope,reference);approved.delete(key);if(approved.size>=10)throw Error('ticket_review_preflight_bound');
   const fresh=await existing(scope,reference.reviewId,signal);if(sha256ContentHash(fresh.binding)!==reference.bindingDigest)throw Error('ticket_review_binding_changed');
   const proof=await repo.$transaction(tx=>store.readApproved(tx,scope,reference.reviewId,fresh.binding));signal.throwIfAborted();approved.set(key,structuredClone(fresh.binding));return proof;
  },
  async readApprovedInTransaction(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,reference:TicketGovernanceReference){
   const binding=approved.get(approvalKey(scope,reference));if(!binding)throw Error('ticket_review_preflight_required');
   return store.readApproved(tx,scope,reference.reviewId,structuredClone(binding));
  },
  async lookup(scope:TicketReviewScope,clientRequestId:string,signal:AbortSignal){
   ticketReviewScopeSchema.parse(scope);z.string().uuid().parse(clientRequestId);signal.throwIfAborted();
   const rows=await repo.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,workflowKind:TICKET_GOVERNANCE_REVIEW_KIND,requestedByUserId:scope.actorUserId,inputJson:{path:['clientRequestId'],equals:clientRequestId}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:2});
   if(rows.length!==1)throw Error('ticket_review_reconciliation_unavailable');const id=rows[0].id;await store.readHistory(scope,id);try{await existing(scope,id,signal)}catch{signal.throwIfAborted();return store.readHistory(scope,id)}return store.get(scope,id);
  },
  async prepare(scope:TicketReviewScope,binding:unknown,clientRequestId:string,signal:AbortSignal){const fresh=await warm(scope,binding,signal);return store.prepare(fresh.scope,fresh.binding,clientRequestId)},
  async get(scope:TicketReviewScope,id:string,signal:AbortSignal){signal.throwIfAborted();await store.readHistory(scope,id);try{await existing(scope,id,signal)}catch{signal.throwIfAborted();return store.readHistory(scope,id)}return store.get(scope,id)},
  async approve(scope:TicketReviewScope,input:{id:string;expectedVersion:number;clientRequestId:string},signal:AbortSignal){await existing(scope,input.id,signal);return store.approve(scope,input)},
  // Cancellation/revocation must remain possible when provider preflight fails.
  async cancel(scope:TicketReviewScope,input:{id:string;expectedVersion:number;clientRequestId:string},signal:AbortSignal){signal.throwIfAborted();return store.cancel(scope,input)},
 };
}
