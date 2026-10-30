import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseServiceNowTicketActionCandidate,type ServiceNowTicketActionCandidate} from './serviceNowTicketLifecycleContract';
import {serviceNowTicketCredentialSchema} from './serviceNowTicketTransport';
import {untilAbort,readBoundedJiraJson} from './jiraTicketTransport';
const time=z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),id=z.string().regex(/^[a-f0-9]{32}$/);
const responseSchema=z.object({result:z.object({present:z.boolean(),changeSysId:id,entryDigest:z.string().regex(/^[a-f0-9]{64}$/),observedAt:time,entry:z.object({id,createdAt:time}).strict().nullable()}).strict()}).strict().refine(v=>v.result.present===(v.result.entry!==null));
type Link=Extract<ServiceNowTicketActionCandidate,{kind:'link'}>;
/** One instance per exact provider dispatch. Presence alone is never an append
 * receipt: confirm requires prior absence, a unique action marker, and a newly
 * created entry on the provider's clock. No network or mutation fallback. */
export function createNarrowServiceNowJournalVerifier(ports:{apiNamespace:string;readCredential:(candidate:Readonly<Link>,signal:AbortSignal)=>Promise<unknown>;assertCurrent:(candidate:Readonly<Link>,signal:AbortSignal)=>Promise<void>;fetchImpl?:typeof fetch;now?:()=>number}){
 const apiNamespace=z.string().regex(/^[A-Za-z0-9_]{1,80}$/).parse(ports.apiNamespace),now=ports.now??Date.now;let baseline:{digest:string;observedAt:string;checkedAt:number}|undefined;
 async function observe(raw:Readonly<Link>,parent:AbortSignal){
  const c=parseServiceNowTicketActionCandidate(raw);if(c.kind!=='link'||!c.association||Date.parse(c.expiresAt)<=now())throw Error('servicenow_associated_journal_required');
  const marker='servicenow_action_'+sha256ContentHash({organizationId:c.organizationId,releaseId:c.releaseId,kind:'link',evidenceId:c.evidence.id});if(!c.payload.work_notes.endsWith('\nAction '+marker))throw Error('servicenow_journal_marker_required');
  const signal=AbortSignal.any([parent,AbortSignal.timeout(10000)]);signal.throwIfAborted();await untilAbort(ports.assertCurrent(c,signal),signal);
  const auth=serviceNowTicketCredentialSchema.parse(await untilAbort(ports.readCredential(c,signal),signal));
  if(!auth.permissions.read||!auth.permissions.journalRead||auth.organizationId!==c.organizationId||auth.connectionId!==c.connectionId||auth.connectionRevision!==c.connectionRevision||auth.instanceOrigin!==c.instanceOrigin||auth.expiresAt<=now()+15000)throw Error('servicenow_journal_authority_unavailable');
  const digest=sha256ContentHash(c.payload.work_notes),url=c.instanceOrigin+'/api/'+apiNamespace+'/v1/axiom_evidence/change/'+c.issue.sysId+'/journal-proof?'+new URLSearchParams({note_digest:digest});
  const response=await untilAbort((ports.fetchImpl??fetch)(url,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${auth.accessToken}`},redirect:'error',credentials:'omit',cache:'no-store',signal}),signal,r=>{void r.body?.cancel().catch(()=>{})});
  if(response.status!==200||response.redirected||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'){void response.body?.cancel().catch(()=>{});throw Error('servicenow_journal_proof_unavailable')}
  const result=responseSchema.parse(await readBoundedJiraJson(response,signal)).result;
  await untilAbort(ports.assertCurrent(c,signal),signal);signal.throwIfAborted();if(result.changeSysId!==c.issue.sysId||result.entryDigest!==digest||auth.expiresAt<=now()||!Number.isFinite(Date.parse(result.observedAt.replace(' ','T')+'Z')))throw Error('servicenow_journal_proof_changed');return result;
 }
 return{
  async assertJournalAbsent(c:Readonly<Link>,signal:AbortSignal){baseline=undefined;const result=await observe(c,signal);if(result.present)return false;baseline={digest:sha256ContentHash(c),observedAt:result.observedAt,checkedAt:now()};return true},
  async readJournalEvidence(c:Readonly<Link>,signal:AbortSignal){const before=baseline;baseline=undefined;if(!before||before.digest!==sha256ContentHash(c)||now()<before.checkedAt||now()-before.checkedAt>=15000)return false;const result=await observe(c,signal);return !!result.present&&!!result.entry&&Number.isFinite(Date.parse(result.entry.createdAt.replace(' ','T')+'Z'))&&result.entry.createdAt>=before.observedAt&&result.entry.createdAt<=result.observedAt&&result.observedAt>=before.observedAt},
 };
}
