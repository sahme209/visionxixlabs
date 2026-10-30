import {serviceNowRequestedScopeSchema,serviceNowGrantedScopesSchema,SERVICE_NOW_PROOF_SCOPE} from './serviceNowScopes';
import 'server-only';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {createAuthorizationState} from '../tenantAuthorization';
import {consumeTenantIntegrationAuthorization,type TenantConnectionRepo} from '../tenantConnectionRepo';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {serviceNowInstanceOriginSchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {buildServiceNowConsentUrl,exchangeServiceNowAuthorizationCode} from './serviceNowOAuth';
const unavailable=():never=>{throw Error('servicenow_authorization_unavailable')};
const id=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x20\x7f-\x9f]/.test(v));
const actorSchema=z.object({organizationId:id,userId:id,canManageConnections:z.literal(true)}).strict();
export const serviceNowRegistrationSchema=z.object({organizationId:id,registrationId:id,revision:z.string().datetime(),instanceOrigin:serviceNowInstanceOriginSchema,clientId:z.string().regex(/^[a-f0-9]{32}$/),clientSecret:z.string().min(1).max(65536).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v)),redirectUri:z.literal('https://visionxixlabs.com/api/integrations/servicenow/callback'),scope:serviceNowRequestedScopeSchema,journalProofNamespace:z.string().regex(/^[A-Za-z0-9_]{1,80}$/).optional()}).strict().superRefine((v,c)=>{if(v.scope.includes(SERVICE_NOW_PROOF_SCOPE)!==!!v.journalProofNamespace)c.addIssue({code:'custom',message:'Exact journal proof registration required'})});
export type ServiceNowAuthorizationActor=z.infer<typeof actorSchema>;
export type ServiceNowRegistration=z.infer<typeof serviceNowRegistrationSchema>;
type Token=Awaited<ReturnType<typeof exchangeServiceNowAuthorizationCode>>;
export interface ServiceNowAuthorizationPorts {
 readCurrentActor:()=>Promise<unknown>;
 readRegistration:(actor:Readonly<ServiceNowAuthorizationActor>,signal:AbortSignal)=>Promise<unknown>;
 /** A fixed, authenticated Change Management read; never a client-supplied assertion. */
 verifyReadAccess?:(registration:Readonly<ServiceNowRegistration>,token:Readonly<Token>,signal:AbortSignal)=>Promise<void>;
 /** Atomically compare registration revision/current authority and preserve existing credentials on conflict. */
 persistConnection?:(actor:Readonly<ServiceNowAuthorizationActor>,registration:Readonly<ServiceNowRegistration>,token:Readonly<Token>,signal:AbortSignal)=>Promise<{connectionId:string}>;
 exchangeCode?:typeof exchangeServiceNowAuthorizationCode;
 now?:()=>number;
}
/** Existing attempt storage is reused without a new schema. State contains 256 random bits followed
 * by a commitment to the non-secret registration and actor. Its full stored hash protects both parts
 * against substitution. Only a matching context can consume it; no ambient provider or password grant.
 * Ports remain unconfigured in production until separately reviewed activation. */
export function createServiceNowAuthorization(repo:TenantConnectionRepo,ports:ServiceNowAuthorizationPorts){
 const clock=ports.now??Date.now;
 const time=()=>{const t=clock();if(!Number.isSafeInteger(t)||t<0||!Number.isFinite(new Date(t).getTime()))unavailable();return t};
 async function snapshot(signal:AbortSignal){
  signal.throwIfAborted();const actor=Object.freeze(actorSchema.parse(await withGithubAbort(ports.readCurrentActor(),signal)));
  const registration=Object.freeze(serviceNowRegistrationSchema.parse(await withGithubAbort(ports.readRegistration(actor,signal),signal)));
  if(registration.organizationId!==actor.organizationId)unavailable();
  const{clientSecret:_,...publicRegistration}=registration;
  return{actor,registration,digest:sha256ContentHash({actor,registration:publicRegistration})};
 }
 async function current(original:Awaited<ReturnType<typeof snapshot>>,signal:AbortSignal){const latest=await snapshot(signal);if(latest.digest!==original.digest||latest.registration.clientSecret!==original.registration.clientSecret)unavailable()}
 async function claim(original:Awaited<ReturnType<typeof snapshot>>,state:string,signal:AbortSignal){
  if(!/^[A-Za-z0-9_-]{86}$/.test(state))unavailable();const bytes=Buffer.from(state,'base64url');
  if(bytes.length!==64||bytes.toString('base64url')!==state||!timingSafeEqual(bytes.subarray(32),Buffer.from(original.digest,'hex')))unavailable();
  const consumed=await withGithubAbort(consumeTenantIntegrationAuthorization(repo,{state:state,provider:'servicenow',now:new Date(time()),expected:{organizationId:original.actor.organizationId,initiatedByUserId:original.actor.userId,redirectUri:original.registration.redirectUri}}),signal);if(!consumed.ok)unavailable();
 }
 return{
 async cancel(input:{state:string;signal:AbortSignal}):Promise<void>{const original=await snapshot(input.signal);await claim(original,input.state,input.signal);await current(original,input.signal)},
 async begin(signal:AbortSignal){
  const original=await snapshot(signal),attempt=createAuthorizationState({now:new Date(time()),random:()=>Buffer.concat([randomBytes(32),Buffer.from(original.digest,'hex')])});
  const consentUrl=buildServiceNowConsentUrl({...original.registration,state:attempt.state});await current(original,signal);
  await withGithubAbort(repo.tenantIntegrationAuthorizationAttempt.create({data:{organizationId:original.actor.organizationId,provider:'servicenow',stateDigest:attempt.stateDigest,redirectUri:original.registration.redirectUri,encryptedPkceVerifier:null,initiatedByUserId:original.actor.userId,expiresAt:attempt.expiresAt}}),signal);
  await current(original,signal);if(attempt.expiresAt.getTime()<=time())unavailable();return{consentUrl,expiresAt:attempt.expiresAt.toISOString()};
 },
 async complete(input:{state:string;code:string;signal:AbortSignal}){
  if(!ports.verifyReadAccess||!ports.persistConnection)unavailable();
  const original=await snapshot(input.signal);
  await claim(original,input.state,input.signal);
  await current(original,input.signal);
  const token=await(ports.exchangeCode??exchangeServiceNowAuthorizationCode)({...original.registration,code:input.code,state:input.state,signal:input.signal,now:clock});
  if(serviceNowGrantedScopesSchema.parse(token.scopes).join(' ')!==original.registration.scope||!Number.isSafeInteger(token.expiresAt)||token.expiresAt<=time()||token.expiresAt>time()+1800000)unavailable();
  await current(original,input.signal);await withGithubAbort(ports.verifyReadAccess!(original.registration,token,input.signal),input.signal);await current(original,input.signal);if(token.expiresAt<=time())unavailable();
  const result=await withGithubAbort(ports.persistConnection!(original.actor,original.registration,token,input.signal),input.signal);await current(original,input.signal);
  return{connectionId:id.parse(result.connectionId),status:'connected_read_only' as const};
 }
 };
}
