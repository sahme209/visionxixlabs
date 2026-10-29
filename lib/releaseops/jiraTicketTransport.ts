import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseJiraTicketActionCandidate,type JiraTicketActionCandidate} from './jiraTicketLifecycleContract';

const native=z.string().regex(/^[0-9]{1,20}$/);
const issue=z.object({id:native,key:z.string().max(128).regex(/^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/)});
const credential=z.object({organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string(),siteId:z.string().uuid(),accessToken:z.string().min(1).max(65536).refine(v=>!/[\r\n]/.test(v)),expiresAt:z.number().finite(),scopes:z.array(z.string()).max(100)}).strict();
export interface JiraTicketTransportDependencies {
 /** Must re-read the durable dispatch claim, independent approval and current actors.
  * No production adapter is supplied by this module. Caller data is not authority. */
 assertCurrent:(actionId:string,candidate:Readonly<JiraTicketActionCandidate>,signal:AbortSignal)=>Promise<void>;
 readCredential:(candidate:Readonly<JiraTicketActionCandidate>,signal:AbortSignal)=>Promise<unknown>;
 fetchImpl?:typeof fetch;
 isEnabled?:()=>boolean;
}
export type JiraTicketTransportResult={status:'confirmed'|'refused'|'unknown';issue?:{id:string;key:string}};
export const jiraTicketRemoteLinkId=(input:{organizationId:string;releaseId:string;issueId:string;evidenceId:string})=>'axiom:deployment:'+sha256ContentHash([input.organizationId,input.releaseId,input.issueId,input.evidenceId]);
export function collectJiraTerminalTransitions(raw:unknown){
 const label=z.string().min(1).max(200).refine(v=>!/[\x00-\x1f\x7f-\x9f]/.test(v));
 const parsed=z.object({transitions:z.array(z.object({id:native,name:label.optional(),isAvailable:z.boolean().optional(),hasScreen:z.boolean().optional(),fields:z.record(z.string(),z.object({required:z.boolean().optional()}).passthrough()).optional(),to:z.object({id:native,name:label.optional(),statusCategory:z.object({key:z.string()})})})).max(200)}).parse(raw);
 if(new Set(parsed.transitions.map(t=>t.id)).size!==parsed.transitions.length)throw Error('jira_ticket_duplicate_transition');
 const transitions=parsed.transitions.filter(t=>t.to.statusCategory.key==='done'&&t.isAvailable!==false&&t.hasScreen===false&&!Object.values(t.fields??{}).some(f=>f.required===true)).map(t=>({id:t.id,name:t.name??'Close ticket',targetStatusId:t.to.id,targetStatusName:t.to.name??'Completed',targetCategory:'done' as const})).sort((a,b)=>a.id.localeCompare(b.id));
 return {discoveryDigest:sha256ContentHash(transitions),transitions};
}
export async function untilAbort<T>(work:Promise<T>,signal:AbortSignal,discard?:(value:T)=>void):Promise<T>{
 if(signal.aborted){void work.then(v=>discard?.(v),()=>{});signal.throwIfAborted()}
 return new Promise((resolve,reject)=>{const abort=()=>{cleanup();reject(Error('jira_ticket_transport_stopped'))};const cleanup=()=>signal.removeEventListener('abort',abort);signal.addEventListener('abort',abort,{once:true});work.then(v=>{cleanup();if(signal.aborted){discard?.(v);reject(Error('jira_ticket_transport_stopped'))}else resolve(v)},()=>{cleanup();reject(Error('jira_ticket_transport_failed'))})});
}
export async function readBoundedJiraJson(response:Response,signal:AbortSignal){
 if(response.redirected||!response.body)throw Error('jira_ticket_response_invalid');
 const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536)){void response.body.cancel().catch(()=>{});throw Error('jira_ticket_response_bound')}
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{while(true){const next=await untilAbort(reader.read(),signal);if(next.done)break;size+=next.value.byteLength;if(size>65536)throw Error('jira_ticket_response_bound');parts.push(next.value)}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)))}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
}
/** Default-off server-only transport; the route must supply current durable authority. Exactly one mutation,
 * no refresh/retry, fixed Atlassian host, and uncertainty after dispatch is retained. */
export function createJiraTicketTransport(deps:JiraTicketTransportDependencies){
 return {async execute(actionId:string,raw:unknown,parent:AbortSignal):Promise<JiraTicketTransportResult>{
  let dispatched=false;
  try{
   const c=parseJiraTicketActionCandidate(raw);
   if(!/^jira_action_[a-f0-9]{64}$/.test(actionId)||typeof deps.assertCurrent!=='function'||typeof deps.readCredential!=='function'||!(deps.isEnabled??(()=>process.env.AXIOM_JIRA_TICKET_WRITES_ENABLED==='true'))()||sha256ContentHash(c.payload)!==c.payloadDigest)return{status:'refused'};
   const deadline=Math.min(Date.now()+15000,Date.parse(c.expiresAt));
   if(c.kind==='link'&&c.payload.globalId!==jiraTicketRemoteLinkId({organizationId:c.organizationId,releaseId:c.releaseId,issueId:c.issue.id,evidenceId:c.evidence.id}))return{status:'refused'};
   const signal=AbortSignal.any([parent,AbortSignal.timeout(Math.max(0,deadline-Date.now()))]);
   const ensure=()=>{signal.throwIfAborted();if(Date.now()>=deadline||!(deps.isEnabled??(()=>process.env.AXIOM_JIRA_TICKET_WRITES_ENABLED==='true'))())throw Error('jira_ticket_transport_stopped')};
   ensure();await untilAbort(deps.assertCurrent(actionId,structuredClone(c),signal),signal);ensure();
   const auth=credential.parse(await untilAbort(deps.readCredential(structuredClone(c),signal),signal));ensure();
   if(auth.organizationId!==c.organizationId||auth.connectionId!==c.connectionId||auth.connectionRevision!==c.connectionRevision||auth.siteId!==c.siteId||auth.expiresAt<=deadline||!auth.scopes.includes('write:jira-work')||!auth.scopes.includes('read:jira-work'))return{status:'refused'};
   const base=`https://api.atlassian.com/ex/jira/${c.siteId}/rest/api/3`,fetcher=deps.fetchImpl??fetch;
   const headers={Accept:'application/json',Authorization:`Bearer ${auth.accessToken}`,'Content-Type':'application/json'};
   const cancel=(response:Response)=>{void response.body?.cancel().catch(()=>{})};
   const request=async(path:string,init:RequestInit)=>{ensure();const response=await untilAbort(fetcher(base+path,{...init,headers,redirect:'error',cache:'no-store',credentials:'omit',signal}),signal,cancel);try{ensure();return response}catch(error){cancel(response);throw error}};
   const read=async(path:string)=>{const response=await request(path,{method:'GET'});if(response.status!==200||response.redirected){cancel(response);throw Error('jira_ticket_read_unavailable')}return readBoundedJiraJson(response,signal)};
   if(c.kind==='close'){
    const observed=collectJiraTerminalTransitions(await read(`/issue/${c.issue.id}/transitions?expand=transitions.fields`));
    const matches=observed.transitions.filter(t=>t.id===c.transition.id&&t.targetStatusId===c.transition.targetStatusId);
    if(matches.length!==1||observed.discoveryDigest!==c.transition.discoveryDigest)return{status:'refused'};
   }
   // Authority is checked again after credentials and any read, immediately before POST.
   await untilAbort(deps.assertCurrent(actionId,structuredClone(c),signal),signal);ensure();
   const body=JSON.stringify(c.payload);if(Buffer.byteLength(body,'utf8')>24576)return{status:'refused'};
   const path=c.kind==='publish'?'/issue':`/issue/${c.issue.id}/${c.kind==='link'?'remotelink':'transitions'}`;
   ensure();dispatched=true;const response=await request(path,{method:'POST',body});
   if(response.redirected){void response.body?.cancel().catch(()=>{});return{status:'unknown'}}
   if(c.kind==='publish'){
    if(response.status!==201){void response.body?.cancel().catch(()=>{});return{status:'unknown'}}
    const saved=issue.parse(await readBoundedJiraJson(response,signal));ensure();await untilAbort(deps.assertCurrent(actionId,structuredClone(c),signal),signal);ensure();return{status:'confirmed',issue:{id:saved.id,key:saved.key}};
   }
   if(c.kind==='link'){
    if(![200,201].includes(response.status)){void response.body?.cancel().catch(()=>{});return{status:'unknown'}}
    z.object({id:z.union([native,z.number().int().positive().safe()])}).parse(await readBoundedJiraJson(response,signal));
   }else{
    void response.body?.cancel().catch(()=>{});if(response.status!==204)return{status:'unknown'};
    const saved=z.object({id:native,key:z.string(),fields:z.object({status:z.object({id:native,statusCategory:z.object({key:z.string()})})})}).parse(await read(`/issue/${c.issue.id}?fields=status`));
    if(saved.id!==c.issue.id||saved.key!==c.issue.key||saved.fields.status.id!==c.transition.targetStatusId||saved.fields.status.statusCategory.key!=='done')return{status:'unknown'};
   }
   ensure();await untilAbort(deps.assertCurrent(actionId,structuredClone(c),signal),signal);ensure();return{status:'confirmed'};
  }catch{return{status:dispatched?'unknown':'refused'}}
 }};
}
