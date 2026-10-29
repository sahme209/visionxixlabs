import 'server-only';
import {z} from 'zod';
import {serviceNowInstanceOriginSchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import {untilAbort} from '@/lib/releaseops/jiraTicketTransport';
interface ConsentInput {instanceOrigin:string;clientId:string;redirectUri:string;state:string}
export interface ServiceNowOAuthDiagnostic {phase:'before_dispatch'|'provider_response'|'token_body'|'token_validation';httpStatus:number|null;scopeMatches:boolean|null;scopePresent:boolean|null;restrictionPresent:boolean|null}
interface ExchangeInput extends ConsentInput {clientSecret:string;code:string;signal:AbortSignal;fetchImpl?:typeof fetch;now?:()=>number;onDiagnostic?:(diagnostic:Readonly<ServiceNowOAuthDiagnostic>)=>void}
const unavailable=()=>Error('servicenow_authorization_unavailable');
const CALLBACK='https://visionxixlabs.com/api/integrations/servicenow/callback';
const SCOPE='axiom.change_management';
const client=z.string().regex(/^[a-f0-9]{32}$/);
const secret=z.string().min(1).max(65536).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v));
function configuration(input:Pick<ConsentInput,'instanceOrigin'|'clientId'|'redirectUri'>){
 const instanceOrigin=serviceNowInstanceOriginSchema.parse(input.instanceOrigin),clientId=client.parse(input.clientId);
 if(input.redirectUri!==CALLBACK)throw unavailable();
 return{instanceOrigin,clientId};
}
/** Platform registration helper only. Routes must bind the originating tenant, actor,
 * instance, client and connection revision into a one-time server-owned attempt.
 * No useraccount fallback, password grant, connection activation or write authority. */
export function buildServiceNowConsentUrl(input:ConsentInput):string{
 try{const config=configuration(input);if(!/^[A-Za-z0-9_-]{43,256}$/.test(input.state))throw unavailable();
 const url=new URL('/oauth_auth.do',config.instanceOrigin);url.search=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:CALLBACK,scope:SCOPE,state:input.state}).toString();return url.toString();
 }catch{throw unavailable()}
}
/** Invoke only AFTER successfully consuming that bound one-time authorization attempt.
 * Returned credentials are server-only values for tenant-bound encryption, never a client DTO.
 * One exchange, no retry; an uncertain outcome requires a fresh user authorization. */
export async function exchangeServiceNowAuthorizationCode(input:ExchangeInput):Promise<{accessToken:string;refreshToken:string|null;expiresAt:number;scopes:string[]}>{
 let response:Response|undefined;
 const diagnostic:ServiceNowOAuthDiagnostic={phase:'before_dispatch',httpStatus:null,scopeMatches:null,scopePresent:null,restrictionPresent:null};
 try{
  const config=configuration(input),clientSecret=secret.parse(input.clientSecret),code=secret.max(4096).parse(input.code);
  if(!/^[A-Za-z0-9_-]{86}$/.test(input.state))throw unavailable();
  input.signal.throwIfAborted();const now=input.now??Date.now,issuedAt=now();if(!Number.isSafeInteger(issuedAt)||issuedAt<0)throw unavailable();
  const signal=AbortSignal.any([input.signal,AbortSignal.timeout(15000)]),fetcher=input.fetchImpl??fetch;
  diagnostic.phase='provider_response';
  response=await untilAbort(fetcher(config.instanceOrigin+'/oauth_token.do',{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:config.clientId,client_secret:clientSecret,redirect_uri:CALLBACK,code,state:input.state}).toString()}),signal,late=>{void late.body?.cancel().catch(()=>{})});
  diagnostic.httpStatus=response.status;
  if(response.status!==200||response.redirected||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw unavailable();
  diagnostic.phase='token_body';
  const bytes=await readBoundedGithubBody(response,signal,131072);
  const raw:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));diagnostic.phase='token_validation';
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){const facts=raw as Record<string,unknown>;diagnostic.scopePresent=Object.hasOwn(facts,'scope');diagnostic.scopeMatches=facts.scope===SCOPE;diagnostic.restrictionPresent=Object.hasOwn(facts,'restricted_to')}
  const token=z.object({access_token:secret,refresh_token:secret.optional(),token_type:z.enum(['Bearer','bearer']),expires_in:z.number().int().min(1).max(1800),scope:z.literal(SCOPE)}).parse(raw);
  const expiresAt=issuedAt+token.expires_in*1000,current=now();signal.throwIfAborted();if(!Number.isSafeInteger(current)||current<issuedAt||!Number.isSafeInteger(expiresAt)||expiresAt<=current)throw unavailable();
  return{accessToken:token.access_token,refreshToken:token.refresh_token??null,expiresAt,scopes:[SCOPE]};
 }catch{try{input.onDiagnostic?.(Object.freeze({...diagnostic}))}catch{/* Diagnostics never change the refusal or trigger a retry. */}throw unavailable()}finally{void response?.body?.cancel().catch(()=>{})}
}
