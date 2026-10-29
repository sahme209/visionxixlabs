import 'server-only';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {connectedActionScopeSchema,type ConnectedActionScope} from '@/lib/integrations/connectedActionContract';
import {authorizationCredentialContext,digestAuthorizationState} from '@/lib/integrations/tenantAuthorization';
import {startTenantIntegrationAuthorization,consumeTenantIntegrationAuthorization,type TenantConnectionRepo} from '@/lib/integrations/tenantConnectionRepo';
import {decryptScopedCredential} from '@/lib/security/credentialVault';
import {withGithubAbort as untilAbort} from '@/lib/connectors/github/boundedGithubRead';
import {buildOutlookAuthorization,outlookPurposeSchema,outlookAuthoritySchema,outlookAccountSchema,parseOutlookCredential,validateOutlookScopes,type OutlookPurpose,type OutlookCredential} from './outlookConnectionContract';
const id=z.string().min(1).max(240),hash=z.string().regex(/^[a-f0-9]{64}$/),secret=z.string().min(1).max(32768).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v));
export const outlookConnectionSnapshotSchema=z.object({id,organizationId:id,provider:z.literal('outlook'),revision:z.string().datetime(),credentialDigest:hash,accountId:id,consentedByUserId:id,status:z.enum(['pending','active','needs_attention','suspended','revoked']),revokedAt:z.string().datetime().nullable()}).strict();
export type OutlookConnectionSnapshot=z.infer<typeof outlookConnectionSnapshotSchema>;
export const outlookRegistrationSchema=z.object({authority:outlookAuthoritySchema,clientId:z.string().uuid(),redirectUri:z.literal('https://visionxixlabs.com/api/integrations/outlook/callback')}).strict();
export type OutlookRegistration=z.infer<typeof outlookRegistrationSchema>;
const payloadSchema=z.object({format:z.literal(1),verifier:z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),purpose:outlookPurposeSchema,registrationDigest:hash,prior:outlookConnectionSnapshotSchema.nullable()}).strict();
const issuedSchema=z.object({access_token:secret,refresh_token:secret.optional(),expires_in:z.number().int().positive().max(172800),scope:z.string().min(1).max(4096)}).passthrough();
export type OutlookIssuedCredential=Omit<OutlookCredential,'account'>;
export interface OutlookOAuthPorts {
 registration:OutlookRegistration;
 assertCurrent:(scope:Readonly<ConnectedActionScope>,signal:AbortSignal)=>Promise<void>;
 readConnection:(scope:Readonly<ConnectedActionScope>,signal:AbortSignal)=>Promise<unknown|null>;
 exchange:(registration:Readonly<OutlookRegistration>,input:{code:string;verifier:string;purpose:OutlookPurpose;signal:AbortSignal})=>Promise<unknown>;
 /** Fixed profile+mailbox/calendar reads; Microsoft login alone is not mailbox readiness. */
 verifyMailbox:(scope:Readonly<ConnectedActionScope>,issued:Readonly<OutlookIssuedCredential>,signal:AbortSignal)=>Promise<unknown>;
 /** CAS the exact expected connection in a transaction, checking current authority before/after.
  * Returns its secret-free persisted snapshot; never legacy upsert or automatic retry. */
 persist:(scope:Readonly<ConnectedActionScope>,expected:OutlookConnectionSnapshot|null,credential:Readonly<OutlookCredential>,signal:AbortSignal)=>Promise<unknown>;
 now?:()=>number;
}
export function createOutlookOAuth(repo:TenantConnectionRepo,ports:OutlookOAuthPorts){
 const registration=outlookRegistrationSchema.parse(ports.registration),now=ports.now??Date.now;
 const actor=async(scope:ConnectedActionScope,signal:AbortSignal)=>{signal.throwIfAborted();await untilAbort(ports.assertCurrent(scope,signal),signal);signal.throwIfAborted()};
 const read=async(scope:ConnectedActionScope,signal:AbortSignal)=>{await actor(scope,signal);const raw=await untilAbort(ports.readConnection(scope,signal),signal);const row=raw===null?null:outlookConnectionSnapshotSchema.parse(raw);if(row&&row.organizationId!==scope.organizationId)throw Error('outlook_connection_changed');return row};
 return{
  async start(rawScope:ConnectedActionScope,rawPurpose:OutlookPurpose,parent:AbortSignal){
   const scope=connectedActionScopeSchema.parse(rawScope),purpose=outlookPurposeSchema.parse(rawPurpose),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]),prior=await read(scope,signal);
   if(purpose==='actions'&&(!prior||prior.status!=='active'||prior.revokedAt||prior.consentedByUserId!==scope.actorUserId))throw Error('outlook_verified_connection_required');
   const verifier=randomBytes(48).toString('base64url'),payload=payloadSchema.parse({format:1,verifier,purpose,registrationDigest:sha256ContentHash(registration),prior});
   const authorization=await untilAbort(startTenantIntegrationAuthorization(repo,{organizationId:scope.organizationId,provider:'outlook',redirectUri:registration.redirectUri,initiatedByUserId:scope.actorUserId,pkceVerifier:JSON.stringify(payload),now:new Date(now())}),signal);
   if(sha256ContentHash(await read(scope,signal))!==sha256ContentHash(prior))throw Error('outlook_connection_changed');
   return{authorizationUrl:buildOutlookAuthorization({...registration,state:authorization.state,verifier,purpose}),expiresAt:authorization.expiresAt.toISOString(),purpose};
  },
  async complete(rawScope:ConnectedActionScope,input:{state:string;code:string},parent:AbortSignal){
   const scope=connectedActionScopeSchema.parse(rawScope),signal=AbortSignal.any([parent,AbortSignal.timeout(30000)]);
   if(!/^[A-Za-z0-9_-]{43,256}$/.test(input.state)||!input.code||Buffer.byteLength(input.code)>16384||/[\x00-\x20\x7f-\x9f]/.test(input.code))throw Error('outlook_invalid_state');
   await actor(scope,signal);const consumed=await untilAbort(consumeTenantIntegrationAuthorization(repo,{provider:'outlook',state:input.state,expected:{organizationId:scope.organizationId,initiatedByUserId:scope.actorUserId,redirectUri:registration.redirectUri},now:new Date(now())}),signal);
   if(!consumed.ok||!consumed.attempt.encryptedPkceVerifier)throw Error('outlook_invalid_state');
   const payload=payloadSchema.parse(JSON.parse(decryptScopedCredential(consumed.attempt.encryptedPkceVerifier,authorizationCredentialContext({organizationId:scope.organizationId,provider:'outlook',stateDigest:digestAuthorizationState(input.state)}))));
   if(payload.registrationDigest!==sha256ContentHash(registration))throw Error('outlook_registration_changed');
   const current=async()=>{await actor(scope,signal);if(consumed.attempt.expiresAt.getTime()<=now()||sha256ContentHash(await read(scope,signal))!==sha256ContentHash(payload.prior))throw Error('outlook_connection_changed')};
   await current();let exchanged:unknown;
   try{exchanged=await untilAbort(ports.exchange(registration,{code:input.code,verifier:payload.verifier,purpose:payload.purpose,signal}),signal)}catch(error){if(error instanceof Error&&error.message==='outlook_exchange_refused')throw error;throw Error('outlook_exchange_outcome_unknown')}
   const token=issuedSchema.parse(exchanged),scopes=validateOutlookScopes(payload.purpose,token.scope.split(/\s+/).filter(Boolean)),issued:OutlookIssuedCredential={purpose:payload.purpose==='read'?'outlook_read_v1':'outlook_actions_v1',accessToken:token.access_token,refreshToken:token.refresh_token??null,expiresAt:now()+token.expires_in*1000,scopes};
   await current();const account=outlookAccountSchema.parse(await untilAbort(ports.verifyMailbox(scope,Object.freeze(issued),signal),signal));
   if(payload.purpose==='actions'&&(!payload.prior||payload.prior.accountId!==account.id||payload.prior.consentedByUserId!==scope.actorUserId))throw Error('outlook_account_changed');
   const credential=parseOutlookCredential({...issued,account});await current();let saved:OutlookConnectionSnapshot;
   try{saved=outlookConnectionSnapshotSchema.parse(await untilAbort(ports.persist(scope,payload.prior,credential,signal),signal))}catch{throw Error('outlook_record_outcome_unknown')}
   await actor(scope,signal);
   if(saved.organizationId!==scope.organizationId||saved.accountId!==account.id||saved.consentedByUserId!==scope.actorUserId||saved.status!=='active'||saved.revokedAt||sha256ContentHash(await read(scope,signal))!==sha256ContentHash(saved))throw Error('outlook_record_outcome_unknown');
   return{status:'connected' as const,account,purpose:payload.purpose,connectionId:saved.id,connectionRevision:saved.revision};
  },
 };
}
