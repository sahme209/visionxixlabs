import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {ticketReviewScopeSchema,ticketAssociationTargetSchema,type TicketReviewScope,type TicketReleaseAssociation} from '@/lib/releaseops/ticketGovernanceReviewContract';
import {parseJiraTicketActionCandidate,type JiraTicketActionCandidate} from '@/lib/releaseops/jiraTicketLifecycleContract';
import {parseServiceNowTicketActionCandidate,type ServiceNowTicketActionCandidate} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {jiraTicketCredentialSchema,readBoundedJiraJson,untilAbort} from '@/lib/releaseops/jiraTicketTransport';
import {readServiceNowTicketRecoveryRecord,serviceNowTicketCredentialSchema} from '@/lib/releaseops/serviceNowTicketTransport';
export interface TicketAssociationProviderReadPorts {
 assertCurrent?:(scope:Readonly<TicketReviewScope>,target:Readonly<TicketReleaseAssociation['ticket']>,signal:AbortSignal)=>Promise<void>;
 readJiraCredential?:(scope:Readonly<TicketReviewScope>,candidate:Readonly<JiraTicketActionCandidate>,signal:AbortSignal)=>Promise<unknown>;
 readServiceNowCredential?:(scope:Readonly<TicketReviewScope>,candidate:Readonly<ServiceNowTicketActionCandidate>,signal:AbortSignal)=>Promise<unknown>;
 fetch?:typeof fetch;now?:()=>number;
}
/** Exact existing-record reads only. Run before taking governance store locks; never search,
 * refresh, create a ticket, follow redirects, or substitute a record after uncertainty. */
export function createTicketAssociationProviderReader(ports:TicketAssociationProviderReadPorts={}){
 return async(rawScope:TicketReviewScope,rawTarget:TicketReleaseAssociation['ticket'],rawCandidate:unknown,parent:AbortSignal)=>{
  const scope=ticketReviewScopeSchema.parse(rawScope),target=ticketAssociationTargetSchema.parse(rawTarget),now=ports.now??Date.now;
  if(!ports.assertCurrent||!ports.fetch||target.provider==='jira'&&!ports.readJiraCredential||target.provider==='servicenow'&&!ports.readServiceNowCredential)throw Error('ticket_provider_read_unavailable');
  const signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]),current=async()=>{signal.throwIfAborted();await untilAbort(ports.assertCurrent!(scope,target,signal),signal);signal.throwIfAborted()};
  await current();let record:unknown;
  if(target.provider==='jira'){
   const c=parseJiraTicketActionCandidate(rawCandidate);
   if(c.kind!=='publish'||c.organizationId!==scope.organizationId||c.connectionId!==target.connectionId||c.siteId!==target.siteId||c.connectionRevision!==target.connectionRevision)throw Error('ticket_provider_binding_changed');
   const auth=jiraTicketCredentialSchema.parse(await untilAbort(ports.readJiraCredential!(scope,c,signal),signal));
   if(auth.organizationId!==scope.organizationId||auth.connectionId!==target.connectionId||auth.connectionRevision!==target.connectionRevision||auth.siteId!==target.siteId||auth.expiresAt<=now()+15000||!auth.scopes.includes('read:jira-work')||new Set(auth.scopes).size!==auth.scopes.length)throw Error('ticket_provider_credential_unavailable');
   await current();const response=await untilAbort(ports.fetch(`https://api.atlassian.com/ex/jira/${target.siteId}/rest/api/3/issue/${target.issue.id}?fields=status`,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${auth.accessToken}`},signal,redirect:'error',credentials:'omit',cache:'no-store'}),signal,r=>{void r.body?.cancel().catch(()=>{})});
   if(response.status!==200||response.redirected){void response.body?.cancel().catch(()=>{});throw Error('ticket_provider_read_unavailable')}
   const issue=z.object({id:z.string().regex(/^[0-9]{1,20}$/),key:z.string(),fields:z.object({status:z.object({id:z.string().regex(/^[0-9]{1,20}$/),statusCategory:z.object({key:z.string().min(1).max(100)})})})}).parse(await readBoundedJiraJson(response,signal));
   if(issue.id!==target.issue.id||issue.key!==target.issue.key)throw Error('ticket_provider_record_mismatch');record=issue;
  }else{
   const c=parseServiceNowTicketActionCandidate(rawCandidate);
   if(c.kind!=='publish'||c.organizationId!==scope.organizationId||c.connectionId!==target.connectionId||c.instanceOrigin!==target.instanceOrigin||c.connectionRevision!==target.connectionRevision)throw Error('ticket_provider_binding_changed');
   const auth=serviceNowTicketCredentialSchema.parse(await untilAbort(ports.readServiceNowCredential!(scope,c,signal),signal));
   if(auth.organizationId!==scope.organizationId||auth.connectionId!==target.connectionId||auth.connectionRevision!==target.connectionRevision||auth.instanceOrigin!==target.instanceOrigin||auth.expiresAt<=now()+15000||!auth.permissions.read)throw Error('ticket_provider_credential_unavailable');
   record=await readServiceNowTicketRecoveryRecord({candidate:c,issue:target.issue,credential:auth,signal,assertCurrent:current,fetchImpl:ports.fetch});
  }
  await current();const at=now();if(!Number.isFinite(at))throw Error('ticket_provider_read_unavailable');
  return Object.freeze({digest:sha256ContentHash({kind:'verified_existing_ticket_read_v1',organizationId:scope.organizationId,target,record}),observedAt:new Date(at).toISOString(),record});
 };
}
