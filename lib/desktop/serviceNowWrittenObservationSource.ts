import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {ticketReviewScopeSchema,type TicketReviewScope} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {serviceNowWrittenLinkObservationSchema,writtenJournalProofSchema} from '@/lib/releaseops/serviceNowWrittenLinkObservationContract';
import {buildServiceNowWrittenLinkObservation} from '@/lib/releaseops/serviceNowWrittenLinkObservation';
import type {z} from 'zod';
type Binding=z.infer<typeof serviceNowWrittenLinkObservationSchema>;
type Proof=z.infer<typeof writtenJournalProofSchema>;
interface Ports{
 /** Fixed GET-only provider adapter. Run before acquiring durable-store locks. */
 readProof:(scope:TicketReviewScope,binding:Binding,signal:AbortSignal)=>Promise<unknown>;
 /** Trusted composition must reload unknown action + independently approved
  * current association under locks, with current reader authority. */
 readLocked:(tx:ReleaseOperationPlanTransaction,scope:TicketReviewScope,binding:Binding)=>Promise<{action:unknown;association:unknown}>;
 now?:()=>number;
}
/** Request-local receipts only. A later presence check never changes the reviewed
 * entry identity or expiry and never changes the original transport outcome. */
export function createServiceNowWrittenObservationSource(ports:Ports){
 const now=ports.now??Date.now,receipts=new Map<string,Proof>(),generations=new Map<string,number>();
 const key=(scope:TicketReviewScope,binding:Binding)=>sha256ContentHash({scope:ticketReviewScopeSchema.parse(scope),binding:serviceNowWrittenLinkObservationSchema.parse(binding)});
 function fresh(proof:Proof){const time=now(),observed=Date.parse(proof.observedAt.replace(' ','T')+'Z');if(!Number.isFinite(time)||!Number.isFinite(observed)||observed>time||time-observed>30000)throw Error('ticket_observation_receipt_expired')}
 function sameEntry(binding:Binding,proof:Proof){if(proof.changeSysId!==binding.issue.sysId||proof.entryDigest!==binding.proof.entryDigest||sha256ContentHash(proof.entry)!==sha256ContentHash(binding.proof.entry))throw Error('ticket_observation_entry_changed')}
 return{
  async warm(rawScope:TicketReviewScope,rawBinding:Binding,parent:AbortSignal){
   const scope=ticketReviewScopeSchema.parse(rawScope),binding=serviceNowWrittenLinkObservationSchema.parse(rawBinding),id=key(scope,binding),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);
   if(scope.organizationId!==binding.organizationId||Date.parse(binding.expiresAt)<=now())throw Error('ticket_observation_scope_changed');
   if(!generations.has(id)&&generations.size>=20)throw Error('ticket_observation_receipt_bound');
   const generation=(generations.get(id)??0)+1;generations.set(id,generation);receipts.delete(id);signal.throwIfAborted();
   const proof=writtenJournalProofSchema.parse(await withGithubAbort(ports.readProof(scope,structuredClone(binding),signal),signal));signal.throwIfAborted();fresh(proof);sameEntry(binding,proof);
   if(generations.get(id)!==generation)throw Error('ticket_observation_receipt_superseded');receipts.set(id,structuredClone(proof));
  },
  async readCurrentBinding(tx:ReleaseOperationPlanTransaction,rawScope:TicketReviewScope,rawBinding:Binding){
   const scope=ticketReviewScopeSchema.parse(rawScope),binding=serviceNowWrittenLinkObservationSchema.parse(rawBinding),id=key(scope,binding),generation=generations.get(id),proof=receipts.get(id);
   if(!proof||scope.organizationId!==binding.organizationId||Date.parse(binding.expiresAt)<=now())throw Error('ticket_observation_receipt_required');fresh(proof);sameEntry(binding,proof);
   const source=await ports.readLocked(tx,scope,structuredClone(binding));if(generations.get(id)!==generation||receipts.get(id)!==proof)throw Error('ticket_observation_receipt_superseded');fresh(proof);if(Date.parse(binding.expiresAt)<=now())throw Error('ticket_observation_review_expired');
   const{digest,...rebuilt}=buildServiceNowWrittenLinkObservation({organizationId:scope.organizationId,actorUserId:binding.executorUserId,action:source.action,association:source.association,proof,now:now()});
   // Only observation time can advance. Reviewed expiry and entry identity stay
   // immutable, with no extension of the current association's authority.
   const normalized={...binding,proof,expiresAt:rebuilt.expiresAt};
   if(Date.parse(binding.expiresAt)>Date.parse(rebuilt.expiresAt)||sha256ContentHash(normalized)!==sha256ContentHash(rebuilt))throw Error('ticket_observation_source_changed');
   return structuredClone(binding);
  },
 };
}
