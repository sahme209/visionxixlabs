import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseServiceNowTicketActionCandidate,serviceNowInstanceOriginSchema,type ServiceNowTicketActionCandidate} from './serviceNowTicketLifecycleContract';
import {untilAbort,readBoundedJiraJson as readBoundedJson} from './jiraTicketTransport';

const sysId=z.string().regex(/^[a-f0-9]{32}$/),number=z.string().regex(/^CHG[0-9]{1,20}$/);
/** Internal, server-verified permissions. These are not ServiceNow OAuth scope names. */
export const serviceNowTicketCredentialSchema=z.object({organizationId:z.string().min(1),connectionId:z.string().min(1),connectionRevision:z.string().datetime(),instanceOrigin:serviceNowInstanceOriginSchema,accessToken:z.string().min(1).max(65536).refine(v=>!/[\x00-\x20\x7f]/.test(v)),expiresAt:z.number().finite(),permissions:z.object({read:z.boolean(),write:z.boolean(),journalRead:z.boolean()}).strict()}).strict();
export interface ServiceNowTicketTransportDependencies{
 assertCurrent:(actionId:string,candidate:Readonly<ServiceNowTicketActionCandidate>,signal:AbortSignal,context?:{phase:'before_dispatch'|'confirm';issue?:{sysId:string;number:string}})=>Promise<void>;
 readCredential:(candidate:Readonly<ServiceNowTicketActionCandidate>,signal:AbortSignal)=>Promise<unknown>;
 /** Re-read the instance's current supported schema/model/mandatory fields and transition criteria.
  * Candidate flags and caller-supplied metadata never satisfy this port. */
 assertNativePlan:(candidate:Readonly<ServiceNowTicketActionCandidate>,signal:AbortSignal)=>Promise<void|{terminalStateValues:readonly string[]}>;
 /** A separately authorized native journal read must prove the exact saved evidence append. */
 assertJournalAbsent?:(candidate:Readonly<Extract<ServiceNowTicketActionCandidate,{kind:'link'}>>,signal:AbortSignal)=>Promise<boolean>;
 readJournalEvidence?:(candidate:Readonly<Extract<ServiceNowTicketActionCandidate,{kind:'link'}>>,signal:AbortSignal)=>Promise<boolean>;
 fetchImpl?:typeof fetch;
 isEnabled?:()=>boolean;
}
export type ServiceNowTicketTransportResult={status:'confirmed'|'refused'|'unknown';issue?:{sysId:string;number:string}};
const state=z.string().min(1).max(128).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f-\x9f]/.test(v));
/** The native endpoint includes current and intermediate states; none are terminal by inference. */
export function collectServiceNowTerminalTransitions(raw:unknown,verifiedTerminalStateValues:readonly string[]){
 const terminals=z.array(state).max(100).parse(verifiedTerminalStateValues);
 const transition=z.object({sys_id:sysId,display_value:z.string().min(1).max(200).refine(v=>!/[\x00-\x1f\x7f-\x9f]/.test(v)),from_state:state,to_state:state,transition_available:z.boolean(),automatic_transition:z.boolean(),conditions:z.array(z.object({passed:z.boolean()}).passthrough()).max(100)}).passthrough();
 const response=z.object({result:z.object({available_states:z.array(state).max(100),state_transitions:z.array(z.union([transition,z.array(transition).max(100)])).max(100)})}).parse(raw).result;
 const all=response.state_transitions.flatMap(t=>Array.isArray(t)?t:[t]);if(all.length>200||new Set(all.map(t=>t.sys_id)).size!==all.length||new Set(terminals).size!==terminals.length)throw Error('servicenow_transition_metadata_invalid');
 const transitions=all.filter(t=>terminals.includes(t.to_state)&&response.available_states.includes(t.to_state)&&t.transition_available&&!t.automatic_transition&&t.from_state!==t.to_state&&t.conditions.every(c=>c.passed)).map(t=>({id:t.sys_id,name:t.display_value,fromStateValue:t.from_state,targetStateValue:t.to_state})).sort((a,b)=>a.id.localeCompare(b.id));
 return{discoveryDigest:sha256ContentHash(transitions),transitions};
}
function record(raw:unknown){if(raw&&typeof raw==='object'&&!Array.isArray(raw)){const outer=raw as Record<string,unknown>,result=outer.result;for(const meta of [outer.__meta,result&&typeof result==='object'&&!Array.isArray(result)?(result as Record<string,unknown>).__meta:undefined]){if(meta===undefined)continue;if(!meta||typeof meta!=='object'||Array.isArray(meta))throw Error('servicenow_unverified_response_metadata');const ignored=(meta as Record<string,unknown>).ignoredFields;if(ignored!==undefined&&(!ignored||typeof ignored!=='object'||Object.keys(ignored).length!==0))throw Error('servicenow_ignored_fields')}}const r=z.object({result:z.record(z.string(),z.unknown())}).parse(raw).result;const value=(name:string)=>{const v=r[name];return v&&typeof v==='object'&&!Array.isArray(v)&&'value'in v?(v as Record<string,unknown>).value:v};return{sysId:sysId.parse(value('sys_id')),number:number.parse(value('number')),value}}
/** Fixed exact-record GET for recovery. No search or mutation fallback exists. */
export async function readServiceNowTicketRecoveryRecord(input:{candidate:Readonly<ServiceNowTicketActionCandidate>;issue:{sysId:string;number:string};credential:unknown;signal:AbortSignal;assertCurrent:()=>Promise<void>;fetchImpl?:typeof fetch}){
 const c=parseServiceNowTicketActionCandidate(input.candidate),auth=serviceNowTicketCredentialSchema.parse(input.credential),issue=z.object({sysId,number}).strict().parse(input.issue);
 if(c.kind!=='publish'||auth.organizationId!==c.organizationId||auth.connectionId!==c.connectionId||auth.connectionRevision!==c.connectionRevision||auth.instanceOrigin!==c.instanceOrigin||!auth.permissions.read||auth.expiresAt<=Date.now()+15000)throw Error('servicenow_recovery_read_unavailable');
 await input.assertCurrent();input.signal.throwIfAborted();
 const response=await untilAbort((input.fetchImpl??fetch)(c.instanceOrigin+'/api/sn_chg_rest/v1/change/'+issue.sysId,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${auth.accessToken}`},signal:input.signal,redirect:'error',cache:'no-store',credentials:'omit'}),input.signal,r=>{void r.body?.cancel().catch(()=>{})});
 if(response.status!==200||response.redirected){void response.body?.cancel().catch(()=>{});throw Error('servicenow_recovery_read_unavailable')}
 const observed=record(await readBoundedJson(response,input.signal));await input.assertCurrent();input.signal.throwIfAborted();
 if(observed.sysId!==issue.sysId||observed.number!==issue.number)throw Error('servicenow_recovery_record_mismatch');
 return{sysId:observed.sysId,number:observed.number,shortDescription:z.string().parse(observed.value('short_description')),description:z.string().nullable().parse(observed.value('description')??null),type:z.string().parse(observed.value('type')),modelSysId:observed.value('chg_model')?sysId.parse(observed.value('chg_model')):null};
}
/** One mutation at most; no credentials from environment, refresh, redirect, or automatic retry. */
export function createServiceNowTicketTransport(deps:ServiceNowTicketTransportDependencies){
 return{async execute(actionId:string,raw:unknown,parent:AbortSignal):Promise<ServiceNowTicketTransportResult>{
  let dispatched=false;
  try{
   const c=parseServiceNowTicketActionCandidate(raw),enabled=()=>Boolean((deps.isEnabled??(()=>process.env.AXIOM_SERVICENOW_TICKET_WRITES_ENABLED==='true'))());
   if(!/^servicenow_action_[a-f0-9]{64}$/.test(actionId)||!enabled()||typeof deps.assertCurrent!=='function'||typeof deps.readCredential!=='function'||typeof deps.assertNativePlan!=='function'||sha256ContentHash(c.payload)!==c.payloadDigest)return{status:'refused'};
   if(c.kind==='publish'&&c.nativeProcess.kind==='standard'&&c.payload.description!==undefined)return{status:'refused'};
   if(c.kind==='publish'&&c.nativeProcess.kind==='model'&&!c.nativeProcess.label)return{status:'refused'};
   const deadline=Math.min(Date.now()+15000,Date.parse(c.expiresAt)),signal=AbortSignal.any([parent,AbortSignal.timeout(Math.max(0,deadline-Date.now()))]);
   const ensure=()=>{signal.throwIfAborted();if(Date.now()>=deadline||!enabled())throw Error('servicenow_ticket_transport_stopped')};
   const current=async(phase:'before_dispatch'|'confirm',issue?:{sysId:string;number:string})=>{ensure();await untilAbort(deps.assertCurrent(actionId,structuredClone(c),signal,{phase,...(issue?{issue}:{})}),signal);ensure()};
   await current('before_dispatch');
   const auth=serviceNowTicketCredentialSchema.parse(await untilAbort(deps.readCredential(structuredClone(c),signal),signal));ensure();
   if(auth.organizationId!==c.organizationId||auth.connectionId!==c.connectionId||auth.connectionRevision!==c.connectionRevision||auth.instanceOrigin!==c.instanceOrigin||auth.expiresAt<=deadline||!auth.permissions.read||!auth.permissions.write||c.kind==='link'&&(!auth.permissions.journalRead||typeof deps.readJournalEvidence!=='function'))return{status:'refused'};
   if(c.kind==='link'&&c.association&&(actionId!=='servicenow_action_'+sha256ContentHash({organizationId:c.organizationId,releaseId:c.releaseId,kind:'link',evidenceId:c.evidence.id})||!c.payload.work_notes.endsWith('\nAction '+actionId)))return{status:'refused'};
   if(c.kind==='link'&&c.association&&(typeof deps.assertJournalAbsent!=='function'||await untilAbort(deps.assertJournalAbsent(structuredClone(c),signal),signal)!==true))return{status:'refused'};
   const native=await untilAbort(deps.assertNativePlan(structuredClone(c),signal),signal);ensure();
   const base=c.instanceOrigin+'/api/sn_chg_rest/v1/change',fetcher=deps.fetchImpl??fetch,headers={Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${auth.accessToken}`};
   const cancel=(r:Response)=>{void r.body?.cancel().catch(()=>{})};
   const request=async(path:string,init:RequestInit)=>{ensure();const r=await untilAbort(fetcher(base+path,{...init,headers:{Accept:headers.Accept,Authorization:headers.Authorization,...(init.body!==undefined?{'Content-Type':'application/json'}:{})},signal,redirect:'error',cache:'no-store',credentials:'omit'}),signal,cancel);try{ensure();if(r.redirected)throw Error('servicenow_ticket_redirect');return r}catch(e){cancel(r);throw e}};
   const read=async(path:string)=>{const r=await request(path,{method:'GET'});if(r.status!==200){cancel(r);throw Error('servicenow_ticket_read_unavailable')}return readBoundedJson(r,signal)};
   if(c.kind!=='publish'){
    const before=record(await read('/'+c.issue.sysId));if(before.sysId!==c.issue.sysId||before.number!==c.issue.number)return{status:'refused'};
    if(c.kind==='close'){
     if(!native||state.parse(before.value('state'))!==c.transition.fromStateValue)return{status:'refused'};
     const options=collectServiceNowTerminalTransitions(await read('/'+c.issue.sysId+'/nextstates'),native.terminalStateValues);
     if(options.discoveryDigest!==c.transition.discoveryDigest||!options.transitions.some(t=>t.id===c.transition.id&&t.fromStateValue===c.transition.fromStateValue&&t.targetStateValue===c.transition.targetStateValue))return{status:'refused'};
    }
   }
   // Current native rules and durable authority are checked after all reads, immediately before mutation.
   await untilAbort(deps.assertNativePlan(structuredClone(c),signal),signal);await current('before_dispatch');
   let path='',method='PATCH',payload:unknown=c.payload;
   if(c.kind==='publish'){method='POST';if(c.nativeProcess.kind==='type')path='/'+c.nativeProcess.typeId;else if(c.nativeProcess.kind==='standard')path='/standard/'+c.nativeProcess.templateSysId+'?'+new URLSearchParams({short_description:c.payload.short_description}).toString();else payload={...c.payload,chg_model:c.nativeProcess.label}}else path='/'+c.issue.sysId;
   const body=JSON.stringify(payload);if(Buffer.byteLength(body,'utf8')>24576)return{status:'refused'};
   ensure();dispatched=true;const response=await request(path,{method,...(c.kind==='publish'&&c.nativeProcess.kind==='standard'?{}:{body})});
   // The native Change Management create endpoint documents 200; retain
   // 201 compatibility only with the same exact identity and readback checks.
   if(c.kind==='publish'?![200,201].includes(response.status):response.status!==200){cancel(response);return{status:'unknown'}}
   const acknowledged=record(await readBoundedJson(response,signal));ensure();
   const expected=c.kind==='publish'?{sysId:acknowledged.sysId,number:acknowledged.number}:c.issue;
   if(acknowledged.sysId!==expected.sysId||acknowledged.number!==expected.number)return{status:'unknown'};
   const after=record(await read('/'+expected.sysId));if(after.sysId!==expected.sysId||after.number!==expected.number)return{status:'unknown'};
   if(c.kind==='publish'){
    if(after.value('short_description')!==c.payload.short_description||c.payload.description!==undefined&&after.value('description')!==c.payload.description)return{status:'unknown'};
    if(c.nativeProcess.kind==='type'&&after.value('type')!==c.nativeProcess.typeId||c.nativeProcess.kind==='model'&&after.value('chg_model')!==c.nativeProcess.modelSysId||c.nativeProcess.kind==='standard'&&after.value('type')!=='standard')return{status:'unknown'};
   }else if(c.kind==='close'){
    if(state.parse(after.value('state'))!==c.transition.targetStateValue||c.payload.close_code!==undefined&&after.value('close_code')!==c.payload.close_code||c.payload.close_notes!==undefined&&after.value('close_notes')!==c.payload.close_notes)return{status:'unknown'};
   }else if(await untilAbort(deps.readJournalEvidence!(structuredClone(c),signal),signal)!==true)return{status:'unknown'};
   await current('confirm',expected);return c.kind==='publish'?{status:'confirmed',issue:expected}:{status:'confirmed'};
  }catch{return{status:dispatched?'unknown':'refused'}}
 }};
}
