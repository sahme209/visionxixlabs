import 'server-only';
import {z} from 'zod';
import {parseServiceNowTicketActionCandidate,type ServiceNowTicketActionCandidate} from './serviceNowTicketLifecycleContract';
import {serviceNowTicketCredentialSchema} from './serviceNowTicketTransport';
import {untilAbort,readBoundedJiraJson} from './jiraTicketTransport';
type Link=Extract<ServiceNowTicketActionCandidate,{kind:'link'}>;
import {type ServiceNowPreflightInspection} from './serviceNowInspectionContract';
/** Fixed GET-only network boundary: no arbitrary URLs, body, redirects or fallback. */
export function serviceNowInspectionFetch(origin:string,issueId:string,apiNamespace:string,fetcher:typeof fetch=fetch):typeof fetch{
 z.string().url().refine(v=>new URL(v).protocol==='https:'&&!new URL(v).username&&!new URL(v).password&&new URL(v).origin===v).parse(origin);z.string().regex(/^[a-f0-9]{32}$/).parse(issueId);z.string().regex(/^[A-Za-z0-9_]{1,80}$/).parse(apiNamespace);
 const paths=new Set(['/api/sn_chg_rest/v1/change/model','/api/sn_chg_rest/v1/change/'+issueId,'/api/'+apiNamespace+'/v1/axiom_evidence/change/'+issueId+'/journal-proof']);
 return async(input,init)=>{if(typeof input!=='string'||(init?.method??'GET')!=='GET'||init?.body!=null)throw Error('inspection_read_only');const u=new URL(input);if(u.origin!==origin||u.username||u.password||u.hash||!paths.has(u.pathname))throw Error('inspection_target_refused');const params=[...u.searchParams];if(u.pathname.endsWith('/journal-proof')?params.length!==1||params[0][0]!=='note_digest'||!/^[a-f0-9]{64}$/.test(params[0][1]):params.length!==0)throw Error('inspection_query_refused');return fetcher(input,{...init,method:'GET',redirect:'error',cache:'no-store',credentials:'omit'})};
}
interface Readers{assertAuthority:(signal:AbortSignal)=>Promise<void>;readCredential:(signal:AbortSignal)=>Promise<unknown>;assertJournalAbsent:(signal:AbortSignal)=>Promise<boolean>;assertNativePlan:(signal:AbortSignal)=>Promise<unknown>}
/** Current read-only observations, never a claim or a reconstruction of an old failure. */
export async function inspectServiceNowPreflight(raw:unknown,ports:{apiNamespace:string;createReaders:(readOnlyFetch:typeof fetch,candidate:Readonly<Link>)=>Readers;fetchImpl?:typeof fetch;now?:()=>number},parent:AbortSignal):Promise<ServiceNowPreflightInspection>{
 const candidate=parseServiceNowTicketActionCandidate(raw);if(candidate.kind!=='link'||!candidate.association)throw Error('inspection_link_required');
 const now=ports.now??Date.now,start=now(),deadline=Math.min(start+15000,Date.parse(candidate.expiresAt));if(deadline<=start)throw Error('inspection_expired');
 const signal=AbortSignal.any([parent,AbortSignal.timeout(deadline-start)]),fetcher=serviceNowInspectionFetch(candidate.instanceOrigin,candidate.issue.sysId,ports.apiNamespace,ports.fetchImpl),readers=ports.createReaders(fetcher,candidate),steps:ServiceNowPreflightInspection['steps']=[];let credential:z.infer<typeof serviceNowTicketCredentialSchema>|undefined;
 const phases:Array<[ServiceNowPreflightInspection['steps'][number]['phase'],()=>Promise<unknown>]>=[
 ['authority',()=>readers.assertAuthority(signal)],['credential',async()=>{credential=serviceNowTicketCredentialSchema.parse(await readers.readCredential(signal));if(credential.organizationId!==candidate.organizationId||credential.connectionId!==candidate.connectionId||credential.connectionRevision!==candidate.connectionRevision||credential.instanceOrigin!==candidate.instanceOrigin||!credential.permissions.read||!credential.permissions.journalRead||credential.expiresAt<=deadline)throw Error('inspection_credential_refused')}],
 ['journal_absence',async()=>{if(await readers.assertJournalAbsent(signal)!==true)throw Error('inspection_note_present')}],['native_plan',()=>readers.assertNativePlan(signal)],
 ['record_read',async()=>{const r=await fetcher(candidate.instanceOrigin+'/api/sn_chg_rest/v1/change/'+candidate.issue.sysId,{method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+credential!.accessToken},signal});if(r.status!==200||r.redirected){void r.body?.cancel().catch(()=>{});throw Error('inspection_record_refused')}const body=z.object({result:z.record(z.string(),z.unknown())}).parse(await readBoundedJiraJson(r,signal)).result;const value=(v:unknown)=>v&&typeof v==='object'&&'value'in v?(v as {value:unknown}).value:v;if(value(body.sys_id)!==candidate.issue.sysId||value(body.number)!==candidate.issue.number)throw Error('inspection_record_changed')}],
 ['final_native_plan',()=>readers.assertNativePlan(signal)],['final_authority',()=>readers.assertAuthority(signal)]];
 for(const[phase,read]of phases){const began=now();try{signal.throwIfAborted();await untilAbort(read(),signal);if(now()>=deadline)throw Error('inspection_deadline');signal.throwIfAborted();steps.push({phase,status:'passed',elapsedMs:Math.max(0,Math.min(60000,Math.floor(now()-began)))})}catch{const status=now()>=deadline||signal.aborted&&!parent.aborted?'timeout':'refused';steps.push({phase,status,elapsedMs:Math.max(0,Math.min(60000,Math.floor(now()-began)))});return{readOnly:true,executionAuthorized:false,status,steps}}}
 return{readOnly:true,executionAuthorized:false,status:'passed',steps};
}
