import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketReviewScopeSchema,serviceNowTerminalPolicySchema,type TicketReviewScope,type ServiceNowTerminalPolicy} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {serviceNowNativeProcessSchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
const receiptSchema=z.object({organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string().datetime(),instanceOrigin:z.string(),nativeProcess:serviceNowNativeProcessSchema,modelDigest:z.string().regex(/^[a-f0-9]{64}$/),observedAt:z.string().datetime()}).strict();
/** Request-scoped verified model snapshots. A locked store can read a snapshot but
 * cannot start provider I/O, and a proposed terminal policy cannot verify itself. */
export function createTicketModelPreflightCache(ports:{readModel?:(scope:TicketReviewScope,policy:ServiceNowTerminalPolicy,signal:AbortSignal)=>Promise<unknown>;now?:()=>number}={}){
 const values=new Map<string,z.infer<typeof receiptSchema>>(),generations=new Map<string,number>(),now=ports.now??Date.now;
 function key(scope:TicketReviewScope,policy:ServiceNowTerminalPolicy){return sha256ContentHash({scope:ticketReviewScopeSchema.parse(scope),policy:serviceNowTerminalPolicySchema.parse(policy)})}
 function validate(raw:unknown,scope:TicketReviewScope,policy:ServiceNowTerminalPolicy){const r=receiptSchema.parse(raw),time=now(),at=Date.parse(r.observedAt);if(!Number.isFinite(time)||at>time||time-at>30000||Date.parse(policy.expiresAt)<=time||r.organizationId!==scope.organizationId||policy.organizationId!==scope.organizationId||r.connectionId!==policy.connectionId||r.connectionRevision!==policy.connectionRevision||r.instanceOrigin!==policy.instanceOrigin||r.modelDigest!==policy.modelDigest||sha256ContentHash(r.nativeProcess)!==sha256ContentHash(policy.nativeProcess))throw Error('ticket_model_preflight_changed');return r}
 return{
  async warm(rawScope:TicketReviewScope,rawPolicy:ServiceNowTerminalPolicy,parent:AbortSignal){
   const scope=ticketReviewScopeSchema.parse(rawScope),policy=serviceNowTerminalPolicySchema.parse(rawPolicy),id=key(scope,policy),generation=(generations.get(id)??0)+1;
   if(!ports.readModel)throw Error('ticket_model_preflight_unavailable');if(!generations.has(id)&&generations.size>=20)throw Error('ticket_model_preflight_bound');generations.set(id,generation);values.delete(id);
   const signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);signal.throwIfAborted();
   const receipt=validate(await withGithubAbort(ports.readModel(scope,policy,signal),signal),scope,policy);signal.throwIfAborted();if(generations.get(id)!==generation)throw Error('ticket_model_preflight_superseded');values.set(id,structuredClone(receipt));return structuredClone(receipt);
  },
  async read(scope:TicketReviewScope,policy:ServiceNowTerminalPolicy){const receipt=values.get(key(scope,policy));if(!receipt)throw Error('ticket_model_preflight_required');return structuredClone(validate(receipt,scope,policy))},
 };
}
