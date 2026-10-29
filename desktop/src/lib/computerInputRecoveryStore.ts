import {z} from 'zod';
import {isComputerInputOwner,type ComputerInputRecoveryPointer} from './computerInputContract';
import type {ObservationOwner} from './computerObservationContract';
const uuid='[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',hash=z.string().regex(/^[a-f0-9]{64}$/);
const pointerSchema=z.object({inputSessionId:z.string().regex(new RegExp('^input_session_'+uuid+'$')),actionId:z.string().regex(new RegExp('^input_action_'+uuid+'$')),taskId:z.string().regex(/^bot_[a-f0-9]{64}$/),taskVersion:z.number().int().min(0).max(2147483647),beforeDigest:hash,afterDigest:hash,targetDigest:hash,expiresAt:z.string().datetime(),ownerContextRef:z.string().regex(new RegExp('^computer_context_'+uuid+'$'))}).strict();
export interface ComputerInputRecoveryIdentity{organizationId:string;userId:string}
const identitySchema=z.object({organizationId:z.string().regex(/^[A-Za-z0-9_-]{1,240}$/),userId:z.string().regex(/^[A-Za-z0-9_-]{1,240}$/)}).strict();
type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
/** Recovery locator only. Never stores document text, screenshots, credentials or execution authority. */
export function createComputerInputRecoveryStore(identity:ComputerInputRecoveryIdentity|undefined,storage?:StoragePort){
 const port=()=>storage??globalThis.localStorage;
 const key=(owner:ObservationOwner)=>{const principal=identitySchema.parse(identity);if(!isComputerInputOwner(owner)||owner.workspaceId!==principal.organizationId)throw Error('recovery_owner_invalid');return 'axiom.computer-input.recovery.v2:'+encodeURIComponent(JSON.stringify([principal.organizationId,principal.userId,owner.taskId,owner.taskVersion]))};
 const parse=(owner:ObservationOwner,value:unknown)=>{const p=pointerSchema.parse(value);if(p.taskId!==owner.taskId||p.taskVersion!==owner.taskVersion)throw Error('recovery_owner_changed');return p};
 return{
  load(owner:ObservationOwner):ComputerInputRecoveryPointer|null{const raw=port().getItem(key(owner));if(raw===null)return null;if(raw.length>4096)throw Error('recovery_pointer_invalid');return parse(owner,JSON.parse(raw))},
  save(owner:ObservationOwner,p:ComputerInputRecoveryPointer){const value=JSON.stringify(parse(owner,p)),k=key(owner);port().setItem(k,value);if(port().getItem(k)!==value)throw Error('recovery_storage_unavailable')},
  clear(owner:ObservationOwner){port().removeItem(key(owner))},
 };
}
