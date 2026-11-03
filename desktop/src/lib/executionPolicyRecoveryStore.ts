import {z} from 'zod';
import type {ExecutionPolicyMutation} from './governanceExecutionPolicy';
const identifier=z.string().min(1).max(256).refine(v=>v.trim()===v&&!/[\x00-\x1f\x7f]/.test(v));
const requestId=z.string().uuid(),id=z.string().regex(/^governance_execution_policy_[a-f0-9]{64}$/),digest=z.string().regex(/^[a-f0-9]{64}$/);
export const executionPolicyRecoveryReferenceSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('propose'),requestId}).strict(),
 z.object({operation:z.literal('approve'),requestId,id,digest}).strict(),
 z.object({operation:z.literal('activate'),requestId,id,digest,expectedPointerVersion:z.number().int().min(0).max(1000)}).strict(),
 z.object({operation:z.literal('revoke'),requestId,id,expectedVersion:z.number().int().min(1).max(2)}).strict(),
]);
export type ExecutionPolicyRecoveryReference=z.infer<typeof executionPolicyRecoveryReferenceSchema>;
const ownerSchema=z.object({serviceOrigin:z.string().min(1).max(2048),organizationId:identifier,userId:identifier}).strict();
export interface ExecutionPolicyRecoveryOwner {serviceOrigin:string;organizationId:string;userId:string}
const recordSchema=z.object({format:z.literal(1),owner:ownerSchema,reference:executionPolicyRecoveryReferenceSchema,createdAt:z.string().datetime()}).strict();
export type ExecutionPolicyRecoveryRecord=z.infer<typeof recordSchema>;
type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
const listeners=new Map<string,Set<()=>void>>();
/** Correlation metadata ONLY. No policy draft, credentials, authority or replay payload. */
export function executionPolicyRecoveryReference(request:ExecutionPolicyMutation):ExecutionPolicyRecoveryReference{
 const common={operation:request.operation,requestId:request.requestId};
 return executionPolicyRecoveryReferenceSchema.parse(request.operation==='propose'?common:request.operation==='revoke'?{...common,id:request.id,expectedVersion:request.version+1}:request.operation==='activate'?{...common,id:request.id,digest:request.digest,expectedPointerVersion:request.pointerVersion===null?0:request.pointerVersion+1}:{...common,id:request.id,digest:request.digest});
}
export function createExecutionPolicyRecoveryStore(rawOwner:ExecutionPolicyRecoveryOwner,storage?:StoragePort){
 const owner=ownerSchema.parse(rawOwner),url=new URL(owner.serviceOrigin);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('recovery_origin_invalid');
 owner.serviceOrigin=url.origin;
 const prefix='axiom.governance-limits.recovery.v1:'+encodeURIComponent(JSON.stringify([owner.serviceOrigin,owner.organizationId,owner.userId]))+':';
 const port=()=>storage??globalThis.localStorage;
 const notify=()=>{for(const listener of listeners.get(prefix)??[])listener()};
 function read(key:string){const text=port().getItem(key);if(text===null)throw Error('recovery_record_disappeared');if(text.length>4096)throw Error('recovery_record_invalid');const record=recordSchema.parse(JSON.parse(text));if(JSON.stringify(record.owner)!==JSON.stringify(owner)||key!==prefix+record.reference.requestId)throw Error('recovery_owner_changed');return record}
 function list(){const count=port().length;if(!Number.isSafeInteger(count)||count<0||count>10000)throw Error('recovery_scan_unavailable');const records:ExecutionPolicyRecoveryRecord[]=[],seen=new Set<string>();for(let i=0;i<count;i++){const key=port().key(i);if(key===null||seen.has(key))throw Error('recovery_scan_changed');seen.add(key);if(key.startsWith(prefix)){if(records.length>=20)throw Error('recovery_history_incomplete');records.push(read(key))}}if(port().length!==count)throw Error('recovery_scan_changed');return records.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.reference.requestId.localeCompare(b.reference.requestId))}

 return{
  list,
  subscribe(listener:()=>void){const set=listeners.get(prefix)??new Set();set.add(listener);listeners.set(prefix,set);return()=>{set.delete(listener);if(!set.size)listeners.delete(prefix)}},
  reserve(request:ExecutionPolicyMutation){const originals=list();if(originals.length>=20)throw Error('recovery_history_incomplete');if(originals.length&&(request.operation!=='revoke'||originals.some(r=>r.reference.operation==='revoke'&&r.reference.id===request.id)))throw Error('original_request_unresolved');const record=recordSchema.parse({format:1,owner,reference:executionPolicyRecoveryReference(request),createdAt:new Date().toISOString()}),text=JSON.stringify(record),key=prefix+record.reference.requestId;if(port().getItem(key)!==null)throw Error('recovery_original_exists');port().setItem(key,text);if(port().getItem(key)!==text)throw Error('recovery_write_unavailable');notify();return record},
  acknowledge(record:ExecutionPolicyRecoveryRecord){const expected=recordSchema.parse(record);const key=prefix+expected.reference.requestId;if(JSON.stringify(read(key))!==JSON.stringify(expected))throw Error('recovery_original_changed');port().removeItem(key);if(port().getItem(key)!==null)throw Error('recovery_clear_unavailable');notify()},
 };
}
