import 'server-only';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createAuthorizationState,digestAuthorizationState} from '../tenantAuthorization';
import {consumeTenantIntegrationAuthorization,type TenantConnectionRepo} from '../tenantConnectionRepo';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {buildJiraConsentUrl,exchangeJiraAuthorizationCode,readJiraAccessibleSites,type JiraOAuthToken} from './jiraOAuth';
const id=z.string().min(1).max(512).refine(v=>v===v.trim()&&!/[\x00-\x20\x7f]/.test(v));
const secret=z.string().min(1).max(65536).refine(v=>!/[\x00-\x20\x7f]/.test(v));
export const jiraTicketWriteBindingSchema=z.object({organizationId:id,userId:id,connectionId:id,connectionRevision:z.string().datetime(),siteId:z.string().uuid(),credentialDigest:z.string().regex(/^[a-f0-9]{64}$/),clientId:id,clientSecret:secret,redirectUri:z.literal('https://visionxixlabs.com/api/integrations/jira/callback')}).strict();
export type JiraTicketWriteBinding=z.infer<typeof jiraTicketWriteBindingSchema>;
export interface JiraTicketWritePorts{
 purpose?:'ticket_reporter_upgrade';
 readBinding:(signal:AbortSignal)=>Promise<unknown>;
 /** Must lock current administrator membership and compare the exact connection revision,
  * encrypted credential digest and site before atomically replacing the token. */
 persistUpgrade:(binding:Readonly<JiraTicketWriteBinding>,token:Readonly<JiraOAuthToken>,signal:AbortSignal)=>Promise<{connectionId:string}>;
 exchangeCode?:typeof exchangeJiraAuthorizationCode;readSites?:typeof readJiraAccessibleSites;now?:()=>number;
}
const unavailable=():never=>{throw Error('jira_ticket_write_authorization_unavailable')};
/** Separate one-time purpose. Initial read consent remains unchanged. A grant is not an
 * independent ticket approval or verification of project-level write permission. */
export function createJiraTicketWriteAuthorization(repo:TenantConnectionRepo,ports:JiraTicketWritePorts){
 const clock=ports.now??Date.now,purpose=ports.purpose??'ticket_write_upgrade',prefix=purpose==='ticket_reporter_upgrade'?'jr1_':'jw1_';
 if(purpose!=='ticket_write_upgrade'&&purpose!=='ticket_reporter_upgrade')throw Error('jira_ticket_write_authorization_unavailable');
 function time(){const t=clock();if(!Number.isSafeInteger(t)||t<0||!Number.isFinite(new Date(t).getTime()))unavailable();return t}
 async function snapshot(signal:AbortSignal){signal.throwIfAborted();const binding=Object.freeze(jiraTicketWriteBindingSchema.parse(await withGithubAbort(ports.readBinding(signal),signal)));const{clientSecret:_,...publicBinding}=binding;return{binding,digest:sha256ContentHash({purpose:purpose==='ticket_reporter_upgrade'?'jira_ticket_reporter_upgrade_v1':'jira_ticket_write_upgrade_v1',binding:publicBinding})}}
 async function current(original:Awaited<ReturnType<typeof snapshot>>,signal:AbortSignal){const latest=await snapshot(signal);if(latest.digest!==original.digest||latest.binding.clientSecret!==original.binding.clientSecret)unavailable()}
 async function claim(original:Awaited<ReturnType<typeof snapshot>>,state:string,signal:AbortSignal){
  if(!new RegExp('^'+prefix+'[A-Za-z0-9_-]{86}$').test(state))unavailable();const bytes=Buffer.from(state.slice(4),'base64url');if(bytes.length!==64||bytes.toString('base64url')!==state.slice(4)||!timingSafeEqual(bytes.subarray(32),Buffer.from(original.digest,'hex')))unavailable();
  const b=original.binding,result=await withGithubAbort(consumeTenantIntegrationAuthorization(repo,{state,provider:'jira',now:new Date(time()),expected:{organizationId:b.organizationId,initiatedByUserId:b.userId,redirectUri:b.redirectUri}}),signal);if(!result.ok)unavailable();
 }
 return{
 async begin(signal:AbortSignal){const original=await snapshot(signal),attempt=createAuthorizationState({now:new Date(time()),random:()=>Buffer.concat([randomBytes(32),Buffer.from(original.digest,'hex')])}),state=prefix+attempt.state,b=original.binding;
  const consentUrl=buildJiraConsentUrl({...b,state,purpose});await current(original,signal);
  await withGithubAbort(repo.tenantIntegrationAuthorizationAttempt.create({data:{organizationId:b.organizationId,provider:'jira',stateDigest:digestAuthorizationState(state),redirectUri:b.redirectUri,encryptedPkceVerifier:null,initiatedByUserId:b.userId,expiresAt:attempt.expiresAt}}),signal);await current(original,signal);if(attempt.expiresAt.getTime()<=time())unavailable();return{consentUrl,expiresAt:attempt.expiresAt.toISOString()};
 },
 async cancel(input:{state:string;signal:AbortSignal}){const original=await snapshot(input.signal);await claim(original,input.state,input.signal);await current(original,input.signal)},
 async complete(input:{state:string;code:string;signal:AbortSignal}){const original=await snapshot(input.signal);await claim(original,input.state,input.signal);await current(original,input.signal);const token=await withGithubAbort((ports.exchangeCode??exchangeJiraAuthorizationCode)({...original.binding,code:input.code,purpose,signal:input.signal,now:clock}),input.signal);
  const validToken=z.object({accessToken:secret,refreshToken:secret,expiresAt:z.number().int().safe(),scopes:z.array(z.enum(['read:jira-work','write:jira-work','offline_access','read:me'])).min(2).max(4)}).parse(token);
  if(purpose==='ticket_reporter_upgrade'?!validToken.scopes.includes('read:me'):validToken.scopes.includes('read:me'))unavailable();
  if(validToken.expiresAt<=time()||validToken.expiresAt>time()+86400000||!validToken.scopes.includes('read:jira-work')||!validToken.scopes.includes('write:jira-work')||new Set(validToken.scopes).size!==validToken.scopes.length)unavailable();
  await current(original,input.signal);const sites=await withGithubAbort((ports.readSites??readJiraAccessibleSites)({accessToken:validToken.accessToken,signal:input.signal}),input.signal),selected=sites.filter(s=>s.id===original.binding.siteId);
  if(selected.length!==1||!selected[0].scopes.includes('read:jira-work')||!selected[0].scopes.includes('write:jira-work')||selected[0].scopes.some(s=>!(purpose==='ticket_reporter_upgrade'?['read:jira-work','write:jira-work','offline_access','read:me']:['read:jira-work','write:jira-work','offline_access']).includes(s)))unavailable();
  await current(original,input.signal);if(validToken.expiresAt<=time())unavailable();const result=await withGithubAbort(ports.persistUpgrade(original.binding,validToken,input.signal),input.signal);if(result.connectionId!==original.binding.connectionId)unavailable();input.signal.throwIfAborted();return{connectionId:result.connectionId,status:'ticket_write_consent_recorded' as const};
 }
 };
}
