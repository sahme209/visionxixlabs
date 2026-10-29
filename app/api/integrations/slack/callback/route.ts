import {randomUUID} from 'node:crypto';
import {NextResponse,type NextRequest} from 'next/server';
import {currentContext} from '@/lib/auth/currentContext';
import {prisma} from '@/lib/db';
import {record as recordAudit} from '@/lib/audit/secureAudit';
import {id as idFactory} from '@/lib/domain/ids';
import {connectionCredentialContext} from '@/lib/integrations/tenantAuthorization';
import {consumeTenantIntegrationAuthorization,type TenantConnectionRepo} from '@/lib/integrations/tenantConnectionRepo';
import {encryptScopedCredential} from '@/lib/security/credentialVault';
import {matchesTrustedIntegrationCallbackUrl,trustedAxiomUrl,trustedIntegrationCallbackUrl} from '@/lib/integrations/trustedCallbackUrl';
import {hasRequiredScopes,splitGrantedScopes} from '@/lib/integrations/grantedScopes';
import {createValidationProviderIo} from '@/lib/integrations/validationProviderIo';
export const dynamic='force-dynamic';export const runtime='nodejs';
class AuthorityChanged extends Error{}
function returnToCompanion(status:string){const destination=trustedAxiomUrl(`/auth/success?integration=slack&status=${encodeURIComponent(status)}`);return destination?NextResponse.redirect(destination):NextResponse.json({ok:false,error:'trusted_return_url_unavailable'},{status:503})}
/** One consumed state permits one bounded exchange. Ambiguous exchange/storage never replays the code. */
export async function GET(request:NextRequest):Promise<Response>{
 const url=new URL(request.url),states=url.searchParams.getAll('state'),codes=url.searchParams.getAll('code');
 if(states.length!==1||!/^[-A-Za-z0-9_]{43,256}$/.test(states[0])||codes.length>1)return returnToCompanion('invalid_state');
 const actor=await currentContext().catch(()=>null);
 const admin=(value:typeof actor)=>!!value?.isAuthenticated&&!!value.sessionUserId&&value.userId===value.sessionUserId&&!!value.organizationId&&value.roles.some(role=>role==='owner'||role==='admin');
 if(!admin(actor))return returnToCompanion('authorization_required');
 const redirectUri=trustedIntegrationCallbackUrl('/api/integrations/slack/callback');
 if(!redirectUri||url.origin+url.pathname!==redirectUri)return returnToCompanion('invalid_state');
 const authorization=await consumeTenantIntegrationAuthorization(prisma as unknown as TenantConnectionRepo,{state:states[0],provider:'slack',expected:{organizationId:String(actor!.organizationId),initiatedByUserId:String(actor!.userId),redirectUri}}).catch(()=>null);
 if(!authorization?.ok)return returnToCompanion('invalid_state');
 const attempt=authorization.attempt;
 const current=async()=>{request.signal.throwIfAborted();const latest=await currentContext();if(!admin(latest)||latest.userId!==actor!.userId||latest.sessionUserId!==actor!.sessionUserId||latest.organizationId!==actor!.organizationId||latest.userId!==attempt.initiatedByUserId||latest.organizationId!==attempt.organizationId||request.signal.aborted||!(attempt.expiresAt instanceof Date)||attempt.expiresAt.getTime()<=Date.now())throw new AuthorityChanged()};
 try{await current()}catch{return returnToCompanion('authorization_required')}
 if(!matchesTrustedIntegrationCallbackUrl('/api/integrations/slack/callback',attempt.redirectUri))return returnToCompanion('invalid_state');
 try{const expected=new URL(attempt.redirectUri);if(url.origin!==expected.origin||url.pathname!==expected.pathname)return returnToCompanion('invalid_state')}catch{return returnToCompanion('invalid_state')}
 if(url.searchParams.has('error'))return returnToCompanion('declined');
 const code=codes[0],clientId=process.env.SLACK_CLIENT_ID?.trim(),clientSecret=process.env.SLACK_CLIENT_SECRET?.trim();
 if(!code||code.length>2048||/[\x00-\x20\x7f]/.test(code)||!clientId||!clientSecret)return returnToCompanion('unavailable');
 const organizationId=attempt.organizationId;
 let existing:Awaited<ReturnType<typeof prisma.tenantIntegrationConnection.findUnique>>;
 try{existing=await prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId,provider:'slack'}}});await current()}catch{return returnToCompanion('authorization_required')}
 const io=createValidationProviderIo(request.signal);
 let token:{access_token:string;scope:string;team:{id:string}};
 try{
  const response=await io.read('https://slack.com/api/oauth.v2.access',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,redirect_uri:attempt.redirectUri})});
  const value=response.json as Record<string,unknown>|null;
  if(!response.ok||value?.ok!==true)return returnToCompanion('exchange_failed');
  const team=value.team as {id?:unknown}|undefined;
  if(typeof value.access_token!=='string'||!value.access_token||Buffer.byteLength(value.access_token,'utf8')>16384||/[\x00-\x20\x7f]/.test(value.access_token)||typeof value.scope!=='string'||value.scope.length>4096||typeof team?.id!=='string'||!/^T[A-Z0-9]{1,99}$/.test(team.id))return returnToCompanion('exchange_outcome_unknown');
  token={access_token:value.access_token,scope:value.scope,team:{id:team.id}};
 }catch{return returnToCompanion('exchange_outcome_unknown')}finally{io.dispose()}
 const grantedScopes=splitGrantedScopes(token.scope);
 if(!hasRequiredScopes(grantedScopes,['channels:read','chat:write'])){
  try{await current();await recordAudit({organizationId:idFactory.organization(organizationId),actorUserId:idFactory.user(attempt.initiatedByUserId),actorKind:'user',action:'connector.connect',outcome:'blocked',entityRef:'connector:slack',correlationId:idFactory.correlation(`slack_scope_${Date.now().toString(36)}`),source:'live',errorCode:'scope_insufficient',detail:{grantedScopeCount:grantedScopes.length,requiredScopeCount:2}})}catch{/* No credential is recorded on a denied scope. */}
  return returnToCompanion('scope_insufficient');
 }
 const connectionId=existing?.id??randomUUID();
 try{
  await current();
  const encryptedCredential=encryptScopedCredential(token.access_token,connectionCredentialContext({organizationId,provider:'slack',connectionId}));
  await prisma.$transaction(async tx=>{
   await current();
   const data={status:'pending',encryptedCredential,externalAccountId:token.team.id,scopesJson:grantedScopes,consentedByUserId:attempt.initiatedByUserId,consentedAt:new Date(),lastValidatedAt:null,revokedAt:null};
   if(existing){const changed=await tx.tenantIntegrationConnection.updateMany({where:{id:existing.id,organizationId,provider:'slack',status:existing.status,encryptedCredential:existing.encryptedCredential,updatedAt:existing.updatedAt,revokedAt:existing.revokedAt},data});if(changed.count!==1)throw new Error('connection_changed')}
   else await tx.tenantIntegrationConnection.create({data:{id:connectionId,organizationId,provider:'slack',...data}});
   await current();
  });
 }catch(error){return returnToCompanion(error instanceof AuthorityChanged?'authorization_required':error instanceof Error&&error.message==='connection_changed'?'connection_changed':'record_outcome_unknown')}
 try{await recordAudit({organizationId:idFactory.organization(organizationId),actorUserId:idFactory.user(attempt.initiatedByUserId),actorKind:'user',action:'connector.connect',outcome:'success',entityRef:'connector:slack',correlationId:idFactory.correlation(`slack_consent_${Date.now().toString(36)}`),source:'live',detail:{scopeCount:grantedScopes.length,validationRequired:true}})}catch{return returnToCompanion('record_outcome_unknown')}
 return returnToCompanion('consent_recorded');
}
