import {serviceNowGrantedScopesSchema} from './serviceNowScopes';
import 'server-only';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {serviceNowInstanceOriginSchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {decryptScopedCredential,encryptScopedCredential} from '@/lib/security/credentialVault';
import {connectionCredentialContext} from '../tenantAuthorization';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {serviceNowRegistrationSchema,type ServiceNowAuthorizationActor,type ServiceNowRegistration} from './serviceNowAuthorization';
const id=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x20\x7f-\x9f]/.test(v));
const secret=z.string().min(1).max(65536).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v));
const tokenSchema=z.object({accessToken:secret,refreshToken:secret.nullable(),expiresAt:z.number().int().safe().nonnegative(),scopes:serviceNowGrantedScopesSchema}).strict();
type Token={accessToken:string;refreshToken:string|null;expiresAt:number;scopes:string[]};
const recoveryEntrySchema=z.object({kind:z.literal('servicenow_refresh_outcome_unknown'),claimId:z.string().uuid(),claimDigest:z.string().regex(/^[a-f0-9]{64}$/),previousRevision:z.string().datetime(),requestedAt:z.string().datetime(),actorUserId:id}).strict();
const envelopeSchema=z.object({kind:z.literal('servicenow_tenant_oauth_v1'),registration:serviceNowRegistrationSchema,token:tokenSchema.nullable(),recoveryHistory:z.array(recoveryEntrySchema).max(16).optional()}).strict();
const rowSchema=z.object({id,organizationId:id,provider:z.literal('servicenow'),status:z.enum(['pending','active','needs_attention']),revokedAt:z.null(),consentedByUserId:id,externalAccountId:z.string(),updatedAt:z.date(),encryptedCredential:z.string().min(1).max(262144)});
const select={id:true,organizationId:true,provider:true,status:true,revokedAt:true,consentedByUserId:true,externalAccountId:true,updatedAt:true,encryptedCredential:true} as const;
interface Delegate{create(args:{data:Record<string,unknown>}):Promise<{id:string}>;findUnique(args:{where:{organizationId_provider:{organizationId:string;provider:'servicenow'}};select:typeof select}):Promise<unknown>;updateMany(args:{where:Record<string,unknown>;data:Record<string,unknown>}):Promise<{count:number}>}
interface Transaction{tenantIntegrationConnection:Delegate;$queryRaw<T>(query:TemplateStringsArray,...values:unknown[]):Promise<T>}
export interface ServiceNowTenantRepository extends Transaction{$transaction<T>(work:(tx:Transaction)=>Promise<T>):Promise<T>}
/** Reads only explicitly provisioned, tenant-encrypted registrations. No global credentials,
 * private-file fallback, arbitrary instance URLs, silent reconnect or schema changes.
 * Activation is called by the bound authorization flow only after its authenticated read probe. */
export function createServiceNowTenantConnectionAdapter(repo:ServiceNowTenantRepository,ports:{readCurrentActor:()=>Promise<unknown>;now?:()=>number}){
 const now=ports.now??Date.now,fail=():never=>{throw Error('servicenow_connection_unavailable')};
 async function authority(actor:ServiceNowAuthorizationActor,signal:AbortSignal){signal.throwIfAborted();const a=z.object({organizationId:id,userId:id,canManageConnections:z.literal(true)}).parse(await withGithubAbort(ports.readCurrentActor(),signal));if(!actor.canManageConnections||a.organizationId!==actor.organizationId||a.userId!==actor.userId)fail()}
 async function load(tx:Pick<Transaction,'tenantIntegrationConnection'>,actor:ServiceNowAuthorizationActor,signal:AbortSignal,allowRefreshRecovery=false){
  await authority(actor,signal);const row=rowSchema.parse(await withGithubAbort(tx.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:actor.organizationId,provider:'servicenow'}},select}),signal));
  if(row.organizationId!==actor.organizationId||row.consentedByUserId!==actor.userId||!Number.isFinite(row.updatedAt.getTime()))fail();
  const context=connectionCredentialContext({organizationId:actor.organizationId,provider:'servicenow',connectionId:row.id});
  let decrypted=JSON.parse(decryptScopedCredential(row.encryptedCredential,context)),refreshClaim:{claimId:string;claimDigest:string}|null=null;
  if(row.status==='needs_attention'){if(!allowRefreshRecovery)fail();const claim=z.object({kind:z.literal('servicenow_refresh_claim_v1'),claimId:z.string().uuid(),originalEncryptedCredential:z.string().min(1).max(262144)}).strict().parse(decrypted);if(claim.originalEncryptedCredential===row.encryptedCredential)fail();refreshClaim={claimId:claim.claimId,claimDigest:sha256ContentHash(row.encryptedCredential)};decrypted=JSON.parse(decryptScopedCredential(claim.originalEncryptedCredential,context))}
  const envelope=envelopeSchema.parse(decrypted);
  if(envelope.registration.organizationId!==actor.organizationId||envelope.registration.instanceOrigin!==row.externalAccountId)fail();await authority(actor,signal);return{row,envelope,context,refreshClaim};
 }
 async function lockAdmin(tx:Transaction,actor:ServiceNowAuthorizationActor,signal:AbortSignal){
  const members=await withGithubAbort(tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${actor.organizationId} AND "userId"=${actor.userId} FOR SHARE`,signal);
  if(members.length!==1||members[0].organizationId!==actor.organizationId||members[0].userId!==actor.userId||!members[0].acceptedAt||!['owner','admin'].includes(members[0].role))fail();
 }
 return{
 async configureRegistration(actor:ServiceNowAuthorizationActor,raw:unknown,signal:AbortSignal){try{
  const input=z.object({instanceOrigin:serviceNowInstanceOriginSchema,clientId:z.string().regex(/^[a-f0-9]{32}$/),clientSecret:secret.min(16).max(4096),expectedRevision:z.string().datetime().optional()}).strict().parse(raw);
  return await withGithubAbort(repo.$transaction(async tx=>{
   await authority(actor,signal);await lockAdmin(tx,actor,signal);
   const current=await withGithubAbort(tx.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:actor.organizationId,provider:'servicenow'}},select}),signal);
   let saved:z.infer<typeof rowSchema>|null=null;
   if(current){const loaded=await load(tx,actor,signal);saved=loaded.row;if(saved.status!=='pending'||loaded.envelope.token!==null||input.expectedRevision!==saved.updatedAt.toISOString())fail()}else if(input.expectedRevision!==undefined)fail();
   const clock=now();if(!Number.isSafeInteger(clock)||clock<0)fail();const revision=new Date(Math.max(clock,saved?saved.updatedAt.getTime()+1:clock));
   const connectionId=saved?.id??randomUUID(),registration=serviceNowRegistrationSchema.parse({organizationId:actor.organizationId,registrationId:randomUUID(),revision:revision.toISOString(),instanceOrigin:input.instanceOrigin,clientId:input.clientId,clientSecret:input.clientSecret,redirectUri:'https://visionxixlabs.com/api/integrations/servicenow/callback',scope:'axiom.change_management'});
   const encryptedCredential=z.string().min(1).max(262144).parse(encryptScopedCredential(JSON.stringify({kind:'servicenow_tenant_oauth_v1',registration,token:null}),connectionCredentialContext({organizationId:actor.organizationId,provider:'servicenow',connectionId})));
   await authority(actor,signal);
   const data={status:'pending',encryptedCredential,externalAccountId:registration.instanceOrigin,scopesJson:registration.scope.split(' '),lastValidatedAt:null,updatedAt:revision};
   if(saved){const changed=await withGithubAbort(tx.tenantIntegrationConnection.updateMany({where:{id:saved.id,organizationId:actor.organizationId,provider:'servicenow',status:'pending',revokedAt:null,consentedByUserId:actor.userId,updatedAt:saved.updatedAt,encryptedCredential:saved.encryptedCredential},data}),signal);if(changed.count!==1)fail()}
   else{const created=await withGithubAbort(tx.tenantIntegrationConnection.create({data:{...data,id:connectionId,organizationId:actor.organizationId,provider:'servicenow',consentedByUserId:actor.userId,revokedAt:null}}),signal);if(created.id!==connectionId)fail()}
   signal.throwIfAborted();return{status:'pending' as const,connectionId,configurationRevision:revision.toISOString()};
  }),signal);
 }catch{throw Error('servicenow_connection_unavailable')}},
 /** Explicit consenting-admin request only. Keep the old token encrypted for
  * recovery; pause connection use until a new bound OAuth grant is verified. */
 async requestJournalProofConsent(actor:ServiceNowAuthorizationActor,raw:unknown,signal:AbortSignal){try{
  const input=z.object({expectedRevision:z.string().datetime(),apiNamespace:z.string().regex(/^[A-Za-z0-9_]{1,80}$/)}).strict().parse(raw);
  return await withGithubAbort(repo.$transaction(async tx=>{await authority(actor,signal);await lockAdmin(tx,actor,signal);const{row,envelope,context,refreshClaim}=await load(tx,actor,signal,true);
   const priorToken=envelope.token;if(!priorToken)throw Error('servicenow_proof_consent_unavailable');
   if(!['active','needs_attention'].includes(row.status)||row.updatedAt.toISOString()!==input.expectedRevision||priorToken.scopes.join(' ')!==envelope.registration.scope||row.status==='active'&&envelope.registration.scope!=='axiom.change_management'||envelope.registration.journalProofNamespace&&envelope.registration.journalProofNamespace!==input.apiNamespace)fail();
   const time=now();if(!Number.isSafeInteger(time)||time<0)fail();const revision=new Date(Math.max(time,row.updatedAt.getTime()+1)),registration=serviceNowRegistrationSchema.parse({...envelope.registration,revision:revision.toISOString(),scope:'axiom.change_management axiom.change_evidence_read',journalProofNamespace:input.apiNamespace});
   const recoveryHistory=refreshClaim?z.array(recoveryEntrySchema).max(16).parse([...(envelope.recoveryHistory??[]),{kind:'servicenow_refresh_outcome_unknown',...refreshClaim,previousRevision:row.updatedAt.toISOString(),requestedAt:revision.toISOString(),actorUserId:actor.userId}]):envelope.recoveryHistory;
   const cipher=z.string().min(1).max(262144).parse(encryptScopedCredential(JSON.stringify({...envelope,registration,...(recoveryHistory?{recoveryHistory}:{})}),context));await authority(actor,signal);
   const changed=await withGithubAbort(tx.tenantIntegrationConnection.updateMany({where:{id:row.id,organizationId:actor.organizationId,provider:'servicenow',status:row.status,revokedAt:null,consentedByUserId:actor.userId,updatedAt:row.updatedAt,encryptedCredential:row.encryptedCredential},data:{status:'pending',encryptedCredential:cipher,scopesJson:[...priorToken.scopes],lastValidatedAt:null,updatedAt:revision}}),signal);if(changed.count!==1)fail();signal.throwIfAborted();return{status:'pending' as const,connectionId:row.id,configurationRevision:revision.toISOString()};
  }),signal);
 }catch{throw Error('servicenow_proof_consent_unavailable')}},
 async readConnectionStatus(actor:ServiceNowAuthorizationActor,signal:AbortSignal){try{await authority(actor,signal);const claimed=z.object({id,organizationId:id,provider:z.literal('servicenow'),status:z.literal('needs_attention'),revokedAt:z.null(),consentedByUserId:id,externalAccountId:serviceNowInstanceOriginSchema,updatedAt:z.date()}).safeParse(await withGithubAbort(repo.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:actor.organizationId,provider:'servicenow'}},select}),signal));if(claimed.success){if(claimed.data.organizationId!==actor.organizationId||claimed.data.consentedByUserId!==actor.userId)fail();await authority(actor,signal);return{connectionId:claimed.data.id,instanceOrigin:claimed.data.externalAccountId,configurationRevision:claimed.data.updatedAt.toISOString(),status:'needs_attention' as const,expiresAt:null}}const{row,envelope}=await load(repo,actor,signal),time=now();if(!Number.isSafeInteger(time)||time<0)fail();const token=envelope.token;return{connectionId:row.id,instanceOrigin:envelope.registration.instanceOrigin,configurationRevision:row.updatedAt.toISOString(),status:row.status==='pending'?'pending' as const:token&&token.expiresAt>time?'connected_read_only' as const:'needs_attention' as const,expiresAt:token?new Date(token.expiresAt).toISOString():null}}catch{throw Error('servicenow_connection_unavailable')}},
 async readRegistration(actor:ServiceNowAuthorizationActor,signal:AbortSignal){try{return(await load(repo,actor,signal)).envelope.registration}catch{throw Error('servicenow_connection_unavailable')}},
 async persistConnection(actor:ServiceNowAuthorizationActor,rawRegistration:ServiceNowRegistration,rawToken:Token,signal:AbortSignal){try{
  const registration=serviceNowRegistrationSchema.parse(rawRegistration),token=tokenSchema.parse(rawToken),time=now();
  if(token.scopes.join(' ')!==registration.scope||!Number.isSafeInteger(time)||time<0||token.expiresAt<=time||token.expiresAt>time+1800000)fail();
  return await withGithubAbort(repo.$transaction(async tx=>{
   await authority(actor,signal);
   await lockAdmin(tx,actor,signal);
   const{row,envelope,context}=await load(tx,actor,signal);
   if(row.status!=='pending'||sha256ContentHash(envelope.registration)!==sha256ContentHash(registration))fail();
   const cipher=z.string().min(1).max(262144).parse(encryptScopedCredential(JSON.stringify({...envelope,kind:'servicenow_tenant_oauth_v1',registration,token}),context));
   await authority(actor,signal);const current=now();if(!Number.isSafeInteger(current)||current<time||token.expiresAt<=current)fail();
   const result=await withGithubAbort(tx.tenantIntegrationConnection.updateMany({where:{id:row.id,organizationId:actor.organizationId,provider:'servicenow',status:'pending',revokedAt:null,consentedByUserId:actor.userId,externalAccountId:row.externalAccountId,updatedAt:row.updatedAt,encryptedCredential:row.encryptedCredential},data:{status:'active',encryptedCredential:cipher,externalAccountId:registration.instanceOrigin,scopesJson:registration.scope.split(' '),lastValidatedAt:new Date(current),updatedAt:new Date(current)}}),signal);
   if(result.count!==1)fail();signal.throwIfAborted();return{connectionId:row.id};
  }),signal);
 }catch{throw Error('servicenow_connection_unavailable')}}
 };
}
/** Shared server-only validation for authenticated desktop projection. */
export const serviceNowStoredConnectionSchema=rowSchema;
export const serviceNowStoredConnectionEnvelopeSchema=envelopeSchema;
