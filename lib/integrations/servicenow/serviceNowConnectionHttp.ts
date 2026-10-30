import 'server-only';
import {hasEmptyAuthorizationBody} from '../emptyAuthorizationRequest';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {isSameOriginRequest} from '@/lib/auth/requestOrigin';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {consumeToken} from '@/lib/api/rateLimiter';
import {createServiceNowAuthorization,type ServiceNowAuthorizationPorts} from './serviceNowAuthorization';
import {exchangeServiceNowAuthorizationCode} from './serviceNowOAuth';
import type {TenantConnectionRepo} from '../tenantConnectionRepo';
interface Options extends ServiceNowAuthorizationPorts{requestJournalProofConsent?:(actor:z.infer<typeof actorSchema>,raw:unknown,signal:AbortSignal)=>Promise<{status:"pending";connectionId:string;configurationRevision:string}>;repo:TenantConnectionRepo;enabled:()=>boolean;configureRegistration?:(actor:z.infer<typeof actorSchema>,raw:unknown,signal:AbortSignal)=>Promise<{status:"pending";connectionId:string;configurationRevision:string}>}
const CALLBACK='https://visionxixlabs.com/api/integrations/servicenow/callback';
const actorSchema=z.object({organizationId:z.string().min(1).max(240),userId:z.string().min(1).max(240),canManageConnections:z.literal(true)}).strict();
const json=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const returned=(status:string)=>{const u=new URL('https://visionxixlabs.com/account/integrations/servicenow');u.search=new URLSearchParams({status}).toString();return NextResponse.redirect(u,{status:303,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})};
/** Fixed provider/callback and server registration only. Codes, state, token bodies,
 * provider error descriptions and arbitrary return URLs never leave the callback. */
export function createServiceNowConnectionHttp(options:Options){
 const readActor=async()=>{if(!options.enabled())throw Error('disabled');const raw=await options.readCurrentActor();return actorSchema.parse(raw)};
 const flow=(stage:{exchange:boolean;save:boolean})=>createServiceNowAuthorization(options.repo,{...options,readCurrentActor:readActor,exchangeCode:async input=>{if(!options.enabled())throw Error('disabled');stage.exchange=true;return(options.exchangeCode??exchangeServiceNowAuthorizationCode)(input)},persistConnection:options.persistConnection?async(...args)=>{if(!options.enabled())throw Error('disabled');stage.save=true;return options.persistConnection!(...args)}:undefined});
 return{
 async configure(request:NextRequest):Promise<Response>{
  if(request.method!=='POST')return json('method_not_allowed',405);
  if(!options.enabled()||!options.configureRegistration)return json('servicenow_setup_unavailable',503);
  if(!isSameOriginRequest(request))return json('invalid_request_origin',403);
  if(request.nextUrl.search||request.headers.get('content-type')?.split(';')[0]!=='application/json')return json('invalid_servicenow_setup',400);
  let actor:z.infer<typeof actorSchema>;try{actor=await readActor()}catch{return json('workspace_owner_required',401)}
  if(!consumeToken(`servicenow-configure:${actor.organizationId}:${actor.userId}`,{capacity:4,tokensPerSecond:0.02}).allowed)return json('servicenow_setup_rate_limited',429);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
  try{
   const reader=request.body?.getReader();if(!reader)return json('invalid_servicenow_setup',400);
   let size=0;const chunks:Uint8Array[]=[];try{while(true){signal.throwIfAborted();const item=await withGithubAbort(reader.read(),signal);if(item.done)break;size+=item.value.byteLength;if(size>16384){await reader.cancel();return json('invalid_servicenow_setup',400)}chunks.push(item.value)}}catch(error){void reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
   const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const proof=z.object({kind:z.literal('journal_proof_consent'),expectedRevision:z.string().datetime(),apiNamespace:z.string().regex(/^[A-Za-z0-9_]{1,80}$/)}).strict();
   let data;if(raw&&typeof raw==='object'&&raw.kind==='journal_proof_consent'){const input=proof.parse(raw);if(!options.requestJournalProofConsent)throw Error('proof_consent_unavailable');const{kind:_,...selected}=input;data=await options.requestJournalProofConsent(actor,selected,signal)}else data=await options.configureRegistration(actor,raw,signal);
   return NextResponse.json({ok:true,data:{status:data.status,connectionId:data.connectionId,configurationRevision:data.configurationRevision}},{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  }catch{return json('servicenow_configuration_unconfirmed',409)}
 },
 async start(request:NextRequest):Promise<Response>{
  if(request.method!=='POST')return json('method_not_allowed',405);
  if(!options.enabled())return json('servicenow_setup_unavailable',503);
  if(!isSameOriginRequest(request))return json('invalid_request_origin',403);
  if(request.nextUrl.search||request.url.length>2048)return json('invalid_servicenow_setup',400);
  try{if(!await hasEmptyAuthorizationBody(request,AbortSignal.any([request.signal,AbortSignal.timeout(15000)])))return json('invalid_servicenow_setup',400)}catch{return json('invalid_servicenow_setup',400)}
  try{const actor=await readActor();if(!consumeToken(`servicenow-setup:${actor.organizationId}:${actor.userId}`,{capacity:8,tokensPerSecond:0.05}).allowed)return json('servicenow_setup_rate_limited',429)}catch{return json('workspace_owner_required',401)}
  try{const data=await flow({exchange:false,save:false}).begin(AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));return NextResponse.json({ok:true,data},{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})}catch{return json('servicenow_setup_unavailable',503)}
 },
 async callback(request:NextRequest):Promise<Response>{
  if(request.method!=='GET')return json('method_not_allowed',405);
  const url=request.nextUrl;
  if(url.origin+url.pathname!==CALLBACK||request.url.length>8192)return returned('invalid_state');
  const state=url.searchParams.getAll('state'),code=url.searchParams.getAll('code'),error=url.searchParams.getAll('error');
  if(state.length!==1||!/^[A-Za-z0-9_-]{86}$/.test(state[0])||code.length>1||error.length>1||code.length===error.length||code.length===1&&(!code[0].length||code[0].length>4096||/[\x00-\x20\x7f]/.test(code[0]))||error.length===1&&(!error[0].length||error[0].length>128))return returned('invalid_state');
  if(!options.enabled())return returned('setup_unconfirmed');
  try{const actor=await readActor();if(!consumeToken(`servicenow-return:${actor.organizationId}:${actor.userId}`,{capacity:12,tokensPerSecond:0.1}).allowed)return returned('setup_unconfirmed')}catch{return returned('authorization_required')}
  const stage={exchange:false,save:false},authorization=flow(stage),signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);
  try{if(error.length){await authorization.cancel({state:state[0],signal});return returned('declined')}
   await authorization.complete({state:state[0],code:code[0],signal});return returned('connected_read_only');
  }catch{return returned(stage.save?'record_outcome_unknown':stage.exchange?'exchange_outcome_unknown':'invalid_state')}
 }
 };
}
