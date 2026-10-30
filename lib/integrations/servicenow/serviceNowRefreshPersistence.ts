import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {connectionCredentialContext} from '../tenantAuthorization';
import {decryptScopedCredential,encryptScopedCredential} from '@/lib/security/credentialVault';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {serviceNowStoredConnectionSchema,serviceNowStoredConnectionEnvelopeSchema} from './serviceNowTenantConnection';
import {refreshServiceNowToken} from './serviceNowRefreshToken';
import {readServiceNowModels} from './serviceNowReadAccess';
const id=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x20\x7f-\x9f]/.test(v));
const actorSchema=z.object({organizationId:id,userId:id,canManageConnections:z.literal(true)}).strict();
const requestSchema=z.object({connectionId:id,revision:z.string().datetime()}).strict();
const select={id:true,organizationId:true,provider:true,status:true,revokedAt:true,consentedByUserId:true,externalAccountId:true,updatedAt:true,encryptedCredential:true} as const;
interface Tx{tenantIntegrationConnection:{findUnique(args:{where:{organizationId_provider:{organizationId:string;provider:'servicenow'}};select:typeof select}):Promise<unknown>;updateMany(args:{where:Record<string,unknown>;data:Record<string,unknown>}):Promise<{count:number}>};$queryRaw<T>(query:TemplateStringsArray,...values:unknown[]):Promise<T>}
export interface ServiceNowRefreshRepository extends Tx{$transaction<T>(work:(tx:Tx)=>Promise<T>):Promise<T>}
/** One durable reservation precedes any refresh POST. Unknown outcomes retain an
 * encrypted copy of the original envelope and cannot automatically retry. This
 * method never increases permissions, creates tickets or changes instance data. */
export function createServiceNowRefreshPersistence(repo:ServiceNowRefreshRepository,ports:{readCurrentActor:()=>Promise<unknown>;fetch:typeof fetch;now?:()=>number}){
 const now=ports.now??Date.now;
 const fail=():never=>{throw Error('servicenow_refresh_unavailable')};
 return async(rawActor:unknown,rawRequest:unknown,callerSignal:AbortSignal)=>{
  const actor=actorSchema.parse(rawActor),request=requestSchema.parse(rawRequest),signal=AbortSignal.any([callerSignal,AbortSignal.timeout(35000)]);
  let reserved=false;
  const current=async()=>{signal.throwIfAborted();const a=actorSchema.parse(await withGithubAbort(ports.readCurrentActor(),signal));if(sha256ContentHash(a)!==sha256ContentHash(actor))fail()};
  const clock=()=>{const n=now();if(!Number.isSafeInteger(n)||n<0)fail();return n};
  const member=async(tx:Tx)=>{await current();const rows=await withGithubAbort(tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${actor.organizationId} AND "userId"=${actor.userId} FOR SHARE`,signal);if(rows.length!==1||rows[0].organizationId!==actor.organizationId||rows[0].userId!==actor.userId||!rows[0].acceptedAt||!['owner','admin'].includes(rows[0].role))fail()};
  try{
   await current();
   const row=serviceNowStoredConnectionSchema.parse(await withGithubAbort(repo.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:actor.organizationId,provider:'servicenow'}},select}),signal));
   if(row.id!==request.connectionId||row.updatedAt.toISOString()!==request.revision||row.organizationId!==actor.organizationId||row.consentedByUserId!==actor.userId||row.status!=='active')fail();
   const context=connectionCredentialContext({organizationId:actor.organizationId,provider:'servicenow',connectionId:row.id}),envelope=serviceNowStoredConnectionEnvelopeSchema.parse(JSON.parse(decryptScopedCredential(row.encryptedCredential,context)));
   const token=envelope.token;if(!token?.refreshToken||token.expiresAt>clock()+60000||envelope.registration.organizationId!==actor.organizationId||envelope.registration.instanceOrigin!==row.externalAccountId)fail();
   const claimRevision=new Date(Math.max(clock(),row.updatedAt.getTime()+1)),claimCipher=encryptScopedCredential(JSON.stringify({kind:'servicenow_refresh_claim_v1',claimId:randomUUID(),originalEncryptedCredential:row.encryptedCredential}),context);
   const where={id:row.id,organizationId:actor.organizationId,provider:'servicenow',status:'active',revokedAt:null,consentedByUserId:actor.userId,externalAccountId:row.externalAccountId,updatedAt:row.updatedAt,encryptedCredential:row.encryptedCredential};
   reserved=true;
   await withGithubAbort(repo.$transaction(async tx=>{await member(tx);const result=await withGithubAbort(tx.tenantIntegrationConnection.updateMany({where,data:{status:'needs_attention',encryptedCredential:claimCipher,updatedAt:claimRevision}}),signal);if(result.count!==1)fail();await current()}),signal);
   reserved=true;
   const claimWhere={...where,status:'needs_attention',updatedAt:claimRevision,encryptedCredential:claimCipher};
   const assertClaim=async(tx:Tx)=>{await member(tx);const currentRow=await withGithubAbort(tx.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:actor.organizationId,provider:'servicenow'}},select}),signal) as Record<string,unknown>|null;if(!currentRow||Object.entries(claimWhere).some(([key,value])=>value instanceof Date?!(currentRow[key] instanceof Date)||(currentRow[key] as Date).getTime()!==value.getTime():currentRow[key]!==value))fail()};
   await repo.$transaction(assertClaim);
   const refreshed=await refreshServiceNowToken({instanceOrigin:envelope.registration.instanceOrigin,clientId:envelope.registration.clientId,clientSecret:envelope.registration.clientSecret,refreshToken:token!.refreshToken!,approvedScopes:[...token!.scopes]},signal,{fetch:ports.fetch,now});
   await repo.$transaction(assertClaim);
   const freshToken={accessToken:refreshed.accessToken,refreshToken:refreshed.refreshToken,expiresAt:refreshed.expiresAt,scopes:[...refreshed.scopes]};
   await readServiceNowModels({instanceOrigin:envelope.registration.instanceOrigin,token:freshToken,signal,fetchImpl:ports.fetch,now});
   await repo.$transaction(async tx=>{await assertClaim(tx);if(freshToken.expiresAt<=clock()+15000)fail();const revision=new Date(Math.max(clock(),claimRevision.getTime()+1)),cipher=encryptScopedCredential(JSON.stringify({...envelope,token:freshToken}),context);const result=await withGithubAbort(tx.tenantIntegrationConnection.updateMany({where:claimWhere,data:{status:'active',encryptedCredential:cipher,scopesJson:[...freshToken.scopes],lastValidatedAt:new Date(clock()),updatedAt:revision}}),signal);if(result.count!==1)fail();await current()});
   return{connectionId:row.id,status:'connected_read_only' as const};
  }catch{throw Error(reserved?'servicenow_refresh_outcome_unknown':'servicenow_refresh_unavailable')}
 };
}
