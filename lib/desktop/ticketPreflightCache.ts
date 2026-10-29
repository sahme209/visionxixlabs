import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketReviewScopeSchema,ticketAssociationTargetSchema,type TicketReviewScope,type TicketReleaseAssociation} from '@/lib/releaseops/ticketGovernanceReviewContract';
interface TicketPreflightCachePorts {
 readTicket?:(scope:TicketReviewScope,target:TicketReleaseAssociation['ticket'],candidate:unknown,signal:AbortSignal)=>Promise<unknown>;
 now?:()=>number;
}
const receiptSchema=z.object({digest:z.string().regex(/^[a-f0-9]{64}$/),observedAt:z.string().datetime(),record:z.unknown().optional()}).strict();
/** Request-scoped cache, never global or persisted. Warm only BEFORE taking DB locks.
 * Locked source readers get immutable receipts only and cannot trigger network activity. */
export function createTicketPreflightCache(ports:TicketPreflightCachePorts={}){
 const receipts=new Map<string,z.infer<typeof receiptSchema>>(),generations=new Map<string,number>(),now=ports.now??Date.now;
 const key=(scope:TicketReviewScope,target:TicketReleaseAssociation['ticket'])=>sha256ContentHash({scope:ticketReviewScopeSchema.parse(scope),target:ticketAssociationTargetSchema.parse(target)});
 const fresh=(receipt:z.infer<typeof receiptSchema>)=>{const time=now(),observed=Date.parse(receipt.observedAt);if(!Number.isFinite(time)||observed>time||time-observed>30000)throw Error('ticket_preflight_expired')};
 return{
  async warmTicket(rawScope:TicketReviewScope,rawTarget:TicketReleaseAssociation['ticket'],candidate:unknown,signal:AbortSignal){
   const scope=ticketReviewScopeSchema.parse(rawScope),target=ticketAssociationTargetSchema.parse(rawTarget),id=key(scope,target),generation=(generations.get(id)??0)+1;
   if(!ports.readTicket)throw Error('ticket_preflight_unavailable');
   if(!generations.has(id)&&generations.size>=20)throw Error('ticket_preflight_bound');
   generations.set(id,generation);receipts.delete(id);signal.throwIfAborted();
   const receipt=receiptSchema.parse(await withGithubAbort(ports.readTicket(scope,target,candidate,signal),signal));signal.throwIfAborted();fresh(receipt);
   if(generations.get(id)!==generation)throw Error('ticket_preflight_superseded');
   receipts.set(id,structuredClone(receipt));return structuredClone(receipt);
  },
  async readTicketReceipt(scope:TicketReviewScope,target:TicketReleaseAssociation['ticket']){
   const receipt=receipts.get(key(scope,target));if(!receipt)throw Error('ticket_preflight_required');fresh(receipt);return structuredClone(receipt);
  },
 };
}
