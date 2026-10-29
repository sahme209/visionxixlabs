import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {authorizationCredentialContext,digestAuthorizationState} from './tenantAuthorization';
import {consumeTenantIntegrationAuthorization,type TenantConnectionRepo} from './tenantConnectionRepo';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
const id=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x20\x7f-\x9f]/.test(v));
export const actionConsentBindingSchema=z.object({provider:z.enum(['teams','linear']),organizationId:id,userId:id,connectionId:id,connectionRevision:z.string().datetime(),credentialDigest:z.string().regex(/^[a-f0-9]{64}$/),externalAccountId:z.string().uuid(),clientId:id,tenantId:z.string().uuid().nullable(),redirectUri:z.string().url()}).strict().refine(b=>b.redirectUri===`https://visionxixlabs.com/api/integrations/${b.provider}/callback`&&(b.provider==='teams'?b.tenantId===b.externalAccountId:b.tenantId===null));
export type ActionConsentBinding=z.infer<typeof actionConsentBindingSchema>;
export {ACTION_CONSENT_SCOPES,validateActionConsentScopes} from './connectedActionScopes';
import {ACTION_CONSENT_SCOPES,validateActionConsentScopes} from './connectedActionScopes';

const secret=z.string().min(1).max(32768).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v));
export const actionConsentTokenSchema=z.object({accessToken:secret,refreshToken:secret.nullable(),expiresAt:z.number().int().safe(),scopes:z.array(z.string()).max(20)}).strict();
export type ActionConsentToken=z.infer<typeof actionConsentTokenSchema>;
export interface ActionConsentPorts{
 readBinding:(signal:AbortSignal)=>Promise<unknown>;
 encrypt:(text:string,context:string)=>string;decrypt:(text:string,context:string)=>string;
 exchange:(binding:Readonly<ActionConsentBinding>,input:{code:string;verifier:string;signal:AbortSignal})=>Promise<unknown>;
 verifyIdentity:(binding:Readonly<ActionConsentBinding>,token:Readonly<ActionConsentToken>,signal:AbortSignal)=>Promise<void>;
 persist:(binding:Readonly<ActionConsentBinding>,token:Readonly<ActionConsentToken>,signal:AbortSignal)=>Promise<void>;
 now?:()=>number;
}
export function createConnectedActionConsent(repo:TenantConnectionRepo,ports:ActionConsentPorts){
 const now=ports.now??Date.now,read=async(s:AbortSignal)=>actionConsentBindingSchema.parse(await withGithubAbort(ports.readBinding(s),s));
 async function current(b:ActionConsentBinding,s:AbortSignal){s.throwIfAborted();if(sha256ContentHash(await read(s))!==sha256ContentHash(b))throw Error('connected_action_connection_changed')}
 return{
 async start(signal:AbortSignal){
  const b=await read(signal),issued=now();if(!Number.isSafeInteger(issued)||issued<0)throw Error('connected_action_consent_unavailable');const state='ca1_'+randomBytes(32).toString('base64url'),stateDigest=digestAuthorizationState(state),verifier=randomBytes(48).toString('base64url'),expiresAt=new Date(issued+600000);
  const encrypted=ports.encrypt(JSON.stringify({kind:'connected_action_consent_v1',binding:b,verifier}),authorizationCredentialContext({organizationId:b.organizationId,provider:b.provider,stateDigest}));
  await current(b,signal);await withGithubAbort(repo.tenantIntegrationAuthorizationAttempt.create({data:{organizationId:b.organizationId,provider:b.provider,stateDigest,redirectUri:b.redirectUri,encryptedPkceVerifier:encrypted,initiatedByUserId:b.userId,expiresAt}}),signal);await current(b,signal);if(now()>=expiresAt.getTime())throw Error('connected_action_consent_unavailable');
  const url=new URL(b.provider==='teams'?`https://login.microsoftonline.com/${b.tenantId}/oauth2/v2.0/authorize`:'https://linear.app/oauth/authorize');
  url.search=new URLSearchParams({client_id:b.clientId,response_type:'code',redirect_uri:b.redirectUri,state,scope:ACTION_CONSENT_SCOPES[b.provider].join(b.provider==='teams'?' ':','),code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'consent',...(b.provider==='teams'?{response_mode:'query'}:{actor:'app'})}).toString();
  return{consentUrl:url.toString(),expiresAt:expiresAt.toISOString()};
 },
 async complete(input:{state:string;code?:string;declined?:boolean;provider:'teams'|'linear';signal:AbortSignal}){
  let exchanged=false;
  try{
   const signal=AbortSignal.any([input.signal,AbortSignal.timeout(25000)]);if(!/^ca1_[A-Za-z0-9_-]{43}$/.test(input.state))return{status:'invalid_state' as const};const b=await read(signal);if(b.provider!==input.provider)return{status:'invalid_state' as const};
   const consumed=await withGithubAbort(consumeTenantIntegrationAuthorization(repo,{state:input.state,provider:b.provider,now:new Date(now()),expected:{organizationId:b.organizationId,initiatedByUserId:b.userId,redirectUri:b.redirectUri}}),signal);if(!consumed.ok)return{status:'invalid_state' as const};const attempt=consumed.attempt;
   if(!attempt.encryptedPkceVerifier)return{status:'invalid_state' as const};
   const envelope=z.object({kind:z.literal('connected_action_consent_v1'),binding:actionConsentBindingSchema,verifier:z.string().regex(/^[A-Za-z0-9_-]{43,128}$/)}).strict().parse(JSON.parse(ports.decrypt(attempt.encryptedPkceVerifier,authorizationCredentialContext({organizationId:b.organizationId,provider:b.provider,stateDigest:digestAuthorizationState(input.state)}))));
   if(sha256ContentHash(envelope.binding)!==sha256ContentHash(b))return{status:'connection_changed' as const};if(input.declined)return{status:'declined' as const};const code=secret.max(16384).parse(input.code);
   const check=async()=>{await current(b,signal);if(attempt.expiresAt.getTime()<=now())throw Error('connected_action_consent_expired')};await check();exchanged=true;
   const token=actionConsentTokenSchema.parse(await withGithubAbort(ports.exchange(b,{code,verifier:envelope.verifier,signal}),signal));token.scopes=validateActionConsentScopes(b.provider,token.scopes);if(token.expiresAt<=now()+15000||token.expiresAt>now()+31536000000)throw Error('connected_action_scope_insufficient');
   await check();await withGithubAbort(ports.verifyIdentity(b,token,signal),signal);await check();await withGithubAbort(ports.persist(b,token,signal),signal);signal.throwIfAborted();return{status:'actions_consent_recorded' as const};
  }catch(e){return{status:e instanceof Error&&e.message==='connected_action_scope_insufficient'?'scope_insufficient' as const:exchanged?'outcome_unconfirmed' as const:'connection_changed' as const}}
 }
 };
}
