import 'server-only';
import {z} from 'zod';
import {recordOutlookReadStatus} from './outlookDiagnostics';
import {connectedActionScopeSchema,type ConnectedActionScope} from '@/lib/integrations/connectedActionContract';
import {outlookConnectionBindingSchema,parseOutlookCredential,outlookAccountSchema,type OutlookConnectionBinding} from './outlookConnectionContract';
import {untilAbort,readBoundedJiraJson} from '@/lib/releaseops/jiraTicketTransport';
export interface OutlookReadinessPorts {
 enabled?:()=>boolean;
 assertCurrent?:(scope:Readonly<ConnectedActionScope>,binding:Readonly<OutlookConnectionBinding>,signal:AbortSignal)=>Promise<void>;
 readCredential?:(scope:Readonly<ConnectedActionScope>,binding:Readonly<OutlookConnectionBinding>,signal:AbortSignal)=>Promise<unknown>;
 fetch?:typeof fetch;now?:()=>number;
}
const rangeSchema=z.object({start:z.string().datetime(),end:z.string().datetime()}).strict().refine(v=>Date.parse(v.end)>Date.parse(v.start)&&Date.parse(v.end)-Date.parse(v.start)<=31*86400000);
const opaque=z.string().min(1).max(2048).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v)),label=z.string().max(1000).refine(v=>!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(v));
const address=z.object({emailAddress:z.object({name:label.optional(),address:z.string().email().max(320)})});
const providerLink=z.string().url().max(4096).refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['outlook.live.com','outlook.office.com','outlook.office365.com'].includes(u.hostname)});
const profileSchema=z.object({id:opaque,displayName:z.string().max(240).nullable(),mail:z.string().email().nullable().optional(),userPrincipalName:z.string().max(320).nullable().optional()});
const messageSchema=z.object({id:opaque,subject:label,from:address.nullable().optional(),receivedDateTime:z.string().datetime(),isRead:z.boolean(),webLink:providerLink});
const date=z.object({dateTime:z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?$/),timeZone:z.literal('UTC')});
const eventSchema=z.object({id:opaque,subject:label,start:date,end:date,organizer:address.optional(),isCancelled:z.boolean(),webLink:providerLink});
const page=<T extends z.ZodTypeAny>(schema:T,max:number)=>z.object({value:z.array(schema).max(max),'@odata.nextLink':z.string().max(4096).optional()});
/** Fixed bounded owner-only mailbox/calendar reads. Never follows nextLink, requests bodies,
 * uses another mailbox URL, changes provider state, refreshes tokens or uploads context to AI. */
export function createOutlookReadinessReader(ports:OutlookReadinessPorts={}){
 return async(rawScope:ConnectedActionScope,rawBinding:OutlookConnectionBinding,rawRange:{start:string;end:string},parent:AbortSignal)=>{
  if(!ports.enabled?.()||!ports.assertCurrent||!ports.readCredential||!ports.fetch)throw Error('outlook_read_unavailable');
  const scope=connectedActionScopeSchema.parse(rawScope),binding=outlookConnectionBindingSchema.parse(rawBinding),range=rangeSchema.parse(rawRange),now=ports.now??Date.now,signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);
  if(binding.organizationId!==scope.organizationId||binding.consentedByUserId!==scope.actorUserId)throw Error('outlook_mailbox_owner_required');
  const current=async()=>{signal.throwIfAborted();if(!ports.enabled?.())throw Error('outlook_read_unavailable');await untilAbort(ports.assertCurrent!(scope,binding,signal),signal);signal.throwIfAborted()};
  await current();const credential=parseOutlookCredential(await untilAbort(ports.readCredential(scope,binding,signal),signal));
  if(credential.account.id!==binding.accountId||credential.expiresAt<=now()+30000)throw Error('outlook_credential_unavailable');
  const get=async(path:string)=>{
   await current();if(credential.expiresAt<=now())throw Error('outlook_refresh_required');
   const url='https://graph.microsoft.com/v1.0'+path,response=await untilAbort(ports.fetch!(url,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${credential.accessToken}`,Prefer:'outlook.timezone="UTC"'},signal,redirect:'error',credentials:'omit',cache:'no-store'}),signal,r=>{void r.body?.cancel().catch(()=>{})});
   recordOutlookReadStatus(path.startsWith('/me?')?'profile':path.startsWith('/me/mailFolders/')?'inbox':'calendar',response.status);
   if(response.redirected||response.url&&response.url!==url){void response.body?.cancel().catch(()=>{});throw Error('outlook_read_unavailable')}
   const body:unknown=await readBoundedJiraJson(response,signal);await current();
   if(response.status!==200){const code=z.object({error:z.object({code:z.string()})}).safeParse(body);if(code.success&&['MailboxNotEnabledForRESTAPI','MailboxNotSupportedForRESTAPI','ErrorInvalidUser','ResourceNotFound'].includes(code.data.error.code)||response.status===404)throw Error('outlook_mailbox_unavailable');if(response.status===401)throw Error('outlook_refresh_required');if(response.status===403)throw Error('outlook_permissions_required');throw Error('outlook_read_unavailable')}
   return body;
  };
  const readProfile=async()=>{const p=profileSchema.parse(await get('/me?$select=id,displayName,mail,userPrincipalName'));if(p.id!==binding.accountId)throw Error('outlook_account_changed');const email=p.mail??(p.userPrincipalName&&z.string().email().safeParse(p.userPrincipalName).success?p.userPrincipalName:null);return outlookAccountSchema.parse({id:p.id,displayName:p.displayName??'',email})};
  const account=await readProfile();
  const inbox=page(messageSchema,10).parse(await get('/me/mailFolders/inbox/messages?'+new URLSearchParams({'$top':'10','$select':'id,subject,from,receivedDateTime,isRead,webLink','$orderby':'receivedDateTime desc'})));
  const calendar=page(eventSchema,20).parse(await get('/me/calendar/calendarView?'+new URLSearchParams({startDateTime:range.start,endDateTime:range.end,'$top':'20','$select':'id,subject,start,end,organizer,isCancelled,webLink'})));
  if(new Set(inbox.value.map(v=>v.id)).size!==inbox.value.length||new Set(calendar.value.map(v=>v.id)).size!==calendar.value.length)throw Error('outlook_read_ambiguous');
  const events=calendar.value.map(v=>{const startUtc=new Date(v.start.dateTime+'Z').toISOString(),endUtc=new Date(v.end.dateTime+'Z').toISOString();if(endUtc<=startUtc||Date.parse(endUtc)<=Date.parse(range.start)||Date.parse(startUtc)>=Date.parse(range.end))throw Error('outlook_calendar_range_changed');return{id:v.id,subject:v.subject,startUtc,endUtc,organizer:v.organizer?.emailAddress??null,isCancelled:v.isCancelled,webLink:v.webLink}});
  await readProfile();await current();
  return{account,binding:{...binding},observedAt:new Date(now()).toISOString(),mail:{messages:inbox.value.map(v=>({id:v.id,subject:v.subject,from:v.from?.emailAddress??null,receivedDateTime:v.receivedDateTime,isRead:v.isRead,webLink:v.webLink})),truncated:!!inbox['@odata.nextLink']},calendar:{range,events,truncated:!!calendar['@odata.nextLink']},providerWritesAvailable:false as const};
 };
}
