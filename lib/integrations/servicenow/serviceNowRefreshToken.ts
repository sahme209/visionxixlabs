import {serviceNowGrantedScopesSchema,parseServiceNowScopeResponse} from './serviceNowScopes';
import 'server-only';
import {z} from 'zod';
import {serviceNowInstanceOriginSchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import {untilAbort} from '@/lib/releaseops/jiraTicketTransport';
const secret=z.string().min(1).max(65536).refine(v=>v===v.trim()&&!/[\x00-\x20\x7f-\x9f]/.test(v));
const inputSchema=z.object({instanceOrigin:serviceNowInstanceOriginSchema,clientId:z.string().regex(/^[a-f0-9]{32}$/),clientSecret:secret,refreshToken:secret,approvedScopes:serviceNowGrantedScopesSchema}).strict();
export class ServiceNowRefreshOutcomeUnknown extends Error{readonly retryAllowed=false;constructor(){super('servicenow_refresh_outcome_unknown')}}
/** Trusted caller must reserve the exact stored credential before invoking this once,
 * then CAS the result into that reservation. No ambient fetch, password, new scope,
 * credential persistence, read/write authority or automatic retry.
 * https://www.servicenow.com/docs/r/platform-security/authentication/r_OAuthAPIRequestParameters.html
 */
export async function refreshServiceNowToken(raw:unknown,callerSignal:AbortSignal,ports:{fetch:typeof fetch;now?:()=>number}){
 let dispatched=false,response:Response|undefined;
 try{
  const input=inputSchema.parse(raw),now=ports.now??Date.now,start=now();
  if(typeof ports.fetch!=='function'||!Number.isSafeInteger(start)||start<0)throw Error();
  const signal=AbortSignal.any([callerSignal,AbortSignal.timeout(15000)]);signal.throwIfAborted();
  const url=input.instanceOrigin+'/oauth_token.do';dispatched=true;
  response=await untilAbort(ports.fetch(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:input.clientId,client_secret:input.clientSecret,refresh_token:input.refreshToken}).toString()}),signal,late=>{void late.body?.cancel().catch(()=>{})});
  if(response.status!==200||response.redirected||response.url&&response.url!==url||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw Error();
  const token=z.object({access_token:secret,refresh_token:secret.optional(),token_type:z.enum(['Bearer','bearer']),expires_in:z.number().int().min(1).max(1800),scope:z.string().optional()}).parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedGithubBody(response,signal,131072))));
  // ServiceNow may return only a new access token; retain only the exact approved
  // stored refresh token/scope when omitted. Never infer a broader grant.
  if(token.scope!==undefined)parseServiceNowScopeResponse(token.scope,input.approvedScopes.join(' '));
  const end=now(),expiresAt=start+token.expires_in*1000;signal.throwIfAborted();
  if(!Number.isSafeInteger(end)||end<start||expiresAt<=end)throw Error();
  return Object.freeze({accessToken:token.access_token,refreshToken:token.refresh_token??input.refreshToken,expiresAt,scopes:Object.freeze([...input.approvedScopes]),persistenceRequired:true as const});
 }catch{throw dispatched?new ServiceNowRefreshOutcomeUnknown():Error('servicenow_refresh_unavailable')}
 finally{void response?.body?.cancel().catch(()=>{})}
}
