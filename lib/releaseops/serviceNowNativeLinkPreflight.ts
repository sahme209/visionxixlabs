import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketGovernanceReferenceSchema,type TicketGovernanceReference} from './ticketGovernanceReference';
import {parseServiceNowTicketActionCandidate,type ServiceNowTicketActionCandidate} from './serviceNowTicketLifecycleContract';
type Link=Extract<ServiceNowTicketActionCandidate,{kind:'link'}>;
/** Private to one authenticated request. No receipt value can cross HTTP/storage. */
export function createServiceNowNativeLinkPreflight(ports:{reference:TicketGovernanceReference;assertNativePlan:(candidate:Readonly<Link>,signal:AbortSignal)=>Promise<unknown>;assertCurrent:(signal:AbortSignal)=>Promise<void>;now?:()=>number}){
 const reference=ticketGovernanceReferenceSchema.parse(ports.reference),now=ports.now??Date.now,receipts=new Map<string,{checkedAt:number;expiresAt:number}>();
 function parse(raw:unknown){const c=parseServiceNowTicketActionCandidate(raw);if(c.kind!=='link'||!c.association||sha256ContentHash(c.association)!==sha256ContentHash(reference))throw Error('servicenow_native_receipt_binding');return c}
 return{
  async validateBeforeClaim(raw:Readonly<Link>,signal:AbortSignal){const c=parse(raw),key=sha256ContentHash(c);receipts.delete(key);signal.throwIfAborted();await ports.assertNativePlan(structuredClone(c),signal);signal.throwIfAborted();await ports.assertCurrent(signal);signal.throwIfAborted();const checkedAt=now(),expiresAt=Math.min(checkedAt+15000,Date.parse(c.expiresAt));if(!Number.isFinite(checkedAt)||!Number.isFinite(expiresAt)||expiresAt<=checkedAt)throw Error('servicenow_native_receipt_expired');for(const[k,r]of receipts)if(r.expiresAt<=checkedAt)receipts.delete(k);if(receipts.size>=5)throw Error('servicenow_native_receipt_bound');receipts.set(key,{checkedAt,expiresAt})},
  consume(raw:Readonly<Link>){try{const c=parse(raw),key=sha256ContentHash(c),receipt=receipts.get(key);receipts.delete(key);const at=now();return !!receipt&&Number.isFinite(at)&&at>=receipt.checkedAt&&at<receipt.expiresAt}catch{return false}},
 };
}
