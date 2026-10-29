import {isActionConsentState,completeConnectedActionConsent} from '@/lib/integrations/connectedActionConsentHttp';
import {randomUUID} from 'node:crypto';
import {NextResponse,type NextRequest} from 'next/server';
import {currentContext} from '@/lib/auth/currentContext';
import {prisma} from '@/lib/db';
import {record as recordAudit} from '@/lib/audit/secureAudit';
import {id as idFactory} from '@/lib/domain/ids';
import {authorizationCredentialContext,digestAuthorizationState,connectionCredentialContext} from '@/lib/integrations/tenantAuthorization';
import {consumeTenantIntegrationAuthorization,type TenantConnectionRepo} from '@/lib/integrations/tenantConnectionRepo';
import {encryptScopedCredential,decryptScopedCredential} from '@/lib/security/credentialVault';
import {matchesTrustedIntegrationCallbackUrl,trustedAxiomUrl,trustedIntegrationCallbackUrl} from '@/lib/integrations/trustedCallbackUrl';
import {splitGrantedScopes} from '@/lib/integrations/grantedScopes';
import {createValidationProviderIo} from '@/lib/integrations/validationProviderIo';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
export const dynamic='force-dynamic';export const runtime='nodejs';
class AuthorityChanged extends Error{}
const callbackStatuses=new Set(['invalid_state','authorization_required','declined','unavailable','exchange_failed','exchange_outcome_unknown','scope_insufficient','connection_changed','record_outcome_unknown','consent_recorded']);
const callbackPhases=['parameters','browser_authority','trusted_callback','state','registration','code_validation','pkce','connection_read','exchange','scope_validation','credential_store','audit','complete'] as const;
function returnToCompanion(status:string,phase:(typeof callbackPhases)[number]){
 const safeStatus=callbackStatuses.has(status)?status:'unavailable';
 console.info('axiom.integration.callback',{provider:'teams',status:safeStatus,phase:callbackPhases.includes(phase)?phase:'parameters'});
 const destination=trustedAxiomUrl(`/auth/success?integration=teams&status=${encodeURIComponent(safeStatus)}`);return destination?NextResponse.redirect(destination):NextResponse.json({ok:false,error:'trusted_return_url_unavailable'},{status:503});
}
/** One consumed state permits one bounded exchange. Ambiguous exchange/storage never replays the code. */
export async function GET(request:NextRequest):Promise<Response>{
 if(isActionConsentState(request.nextUrl.searchParams.get('state')))return completeConnectedActionConsent(request,'teams');
 const deadline=Date.now()+25000,signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);const guard=()=>{signal.throwIfAborted();if(Date.now()>=deadline)throw new AuthorityChanged()};
 const url=new URL(request.url),states=url.searchParams.getAll('state'),codes=url.searchParams.getAll('code');
 if(states.length!==1||!/^[-A-Za-z0-9_]{43,256}$/.test(states[0])||codes.length>1)return returnToCompanion('invalid_state','parameters');
 const actor=await withGithubAbort(currentContext(),signal).catch(()=>null);
 const admin=(value:typeof actor)=>!!value?.isAuthenticated&&!!value.sessionUserId&&value.userId===value.sessionUserId&&!!value.organizationId&&value.roles.some(role=>role==='owner'||role==='admin');
 if(!admin(actor))return returnToCompanion('authorization_required','browser_authority');
 const redirectUri=trustedIntegrationCallbackUrl('/api/integrations/teams/callback');
 if(!redirectUri||url.origin+url.pathname!==redirectUri)return returnToCompanion('invalid_state','trusted_callback');
 const authorization=await withGithubAbort(consumeTenantIntegrationAuthorization(prisma as unknown as TenantConnectionRepo,{state:states[0],provider:'teams',expected:{organizationId:String(actor!.organizationId),initiatedByUserId:String(actor!.userId),redirectUri}}),signal).catch(()=>null);
 if(!authorization?.ok)return returnToCompanion('invalid_state','state');
 const attempt=authorization.attempt;
 const current=async()=>{guard();const latest=await withGithubAbort(currentContext(),signal);guard();if(!admin(latest)||latest.userId!==actor!.userId||latest.sessionUserId!==actor!.sessionUserId||latest.organizationId!==actor!.organizationId||latest.userId!==attempt.initiatedByUserId||latest.organizationId!==attempt.organizationId||signal.aborted||!matchesTrustedIntegrationCallbackUrl('/api/integrations/teams/callback',attempt.redirectUri)||!(attempt.expiresAt instanceof Date)||attempt.expiresAt.getTime()<=Date.now())throw new AuthorityChanged()};
 try{await current()}catch{return returnToCompanion('authorization_required','browser_authority')}
 if(!matchesTrustedIntegrationCallbackUrl('/api/integrations/teams/callback',attempt.redirectUri))return returnToCompanion('invalid_state','trusted_callback');
 try{const expected=new URL(attempt.redirectUri);if(url.origin!==expected.origin||url.pathname!==expected.pathname)return returnToCompanion('invalid_state','trusted_callback')}catch{return returnToCompanion('invalid_state','trusted_callback')}
 if(url.searchParams.has('error'))return returnToCompanion('declined','parameters');
 const code=codes[0],clientId=process.env.MICROSOFT_CLIENT_ID?.trim(),clientSecret=process.env.MICROSOFT_CLIENT_SECRET?.trim(),tenant=process.env.MICROSOFT_TENANT_ID?.trim();
 // OAuth codes are opaque and provider-dependent; bound actual UTF-8 bytes,
 // not an arbitrary short character count. This is not evidence of a live failure cause.
 if(!code||Buffer.byteLength(code,'utf8')>16384||/[\x00-\x20\x7f-\x9f]/.test(code))return returnToCompanion('unavailable','code_validation');
 if(!clientId||!clientSecret||!tenant)return returnToCompanion('unavailable','registration');
 let verifier:string;try{if(!attempt.encryptedPkceVerifier)throw new Error('missing_pkce');verifier=decryptScopedCredential(attempt.encryptedPkceVerifier,authorizationCredentialContext({organizationId:attempt.organizationId,provider:'teams',stateDigest:digestAuthorizationState(states[0])}));if(!/^[A-Za-z0-9_-]{43,128}$/.test(verifier))throw new Error('invalid_pkce')}catch{return returnToCompanion('invalid_state','pkce')}
 const organizationId=attempt.organizationId;
 let existing:Awaited<ReturnType<typeof prisma.tenantIntegrationConnection.findUnique>>;
 try{existing=await withGithubAbort(prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId,provider:'teams'}}}),signal);await current()}catch{return returnToCompanion('authorization_required','connection_read')}
 const io=createValidationProviderIo(signal);
 let token:{accessToken:string;refreshToken:string|null;expiresAt:number|null},grantedScopes:string[];
 try{
  await current();
  const response=await io.read(`https://login.microsoftonline.com/${encodeURIComponent(tenant!)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'authorization_code',code,redirect_uri:attempt.redirectUri,code_verifier:verifier})});
  const value=response.json as Record<string,unknown>|null;
  if(!response.ok){const definite=[400,401].includes(response.status)&&value&&typeof value.error==='string'&&['invalid_grant','invalid_client','unauthorized_client','invalid_request','invalid_scope','unsupported_grant_type'].includes(value.error);return returnToCompanion(definite?'exchange_failed':'exchange_outcome_unknown','exchange')}
  const validToken=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v,'utf8')<=16384&&!/[\x00-\x20\x7f-\x9f]/.test(v);
  if(!value||!validToken(value.access_token)||value.refresh_token!==undefined&&!validToken(value.refresh_token)||value.expires_in!==undefined&&(typeof value.expires_in!=='number'||!Number.isFinite(value.expires_in)||value.expires_in<=0||value.expires_in>31536000))return returnToCompanion('exchange_outcome_unknown','exchange');
  const scopes=value.scope;if(typeof scopes==='string'&&scopes.length<=4096)grantedScopes=splitGrantedScopes(scopes);else return returnToCompanion('exchange_outcome_unknown','exchange');
  token={accessToken:value.access_token,refreshToken:(value.refresh_token as string|undefined)??null,expiresAt:typeof value.expires_in==='number'?Date.now()+value.expires_in*1000:null};
 }catch{return returnToCompanion('exchange_outcome_unknown','exchange')}finally{io.dispose()}
 // Resource grants are reported separately from requested OIDC scopes. Keep
 // the provider's exact reported strings in storage; normalize only to verify
 // this narrowly supported identity read, never to manufacture a grant.
 const isIdentityResource=(scope:string)=>/^user\.read$/i.test(scope)||/^https:\/\/graph\.microsoft\.com\/user\.read$/i.test(scope);
 const knownOidcLabels=['openid','offline_access','profile','email'] as const;
 const isOidcMetadata=(scope:string)=>knownOidcLabels.some(label=>scope===label);
 const hasRequiredResource=grantedScopes.some(isIdentityResource);
 const hasUnsupportedResource=grantedScopes.some(scope=>!isIdentityResource(scope)&&!isOidcMetadata(scope));
 const scopeCountWithinBounds=grantedScopes.length>0&&grantedScopes.length<=20;
 if(!scopeCountWithinBounds||!hasRequiredResource||hasUnsupportedResource){
  console.info('axiom.integration.scope_validation',{provider:'teams',hasRequiredResource,hasUnsupportedResource,scopeCountWithinBounds,knownOidc:knownOidcLabels.filter(label=>grantedScopes.includes(label))});
  try{await current();await recordAudit({organizationId:idFactory.organization(organizationId),actorUserId:idFactory.user(attempt.initiatedByUserId),actorKind:'user',action:'connector.connect',outcome:'blocked',entityRef:'connector:teams',correlationId:idFactory.correlation(`teams_scope_${Date.now().toString(36)}`),source:'live',errorCode:'scope_insufficient',detail:{grantedScopeCount:grantedScopes.length,requiredResourceScopeCount:1,requestedScopeCount:3}})}catch{/* No credential is recorded on denied scopes. */}
  return returnToCompanion('scope_insufficient','scope_validation');
 }
 const connectionId=existing?.id??randomUUID();
 try{
  await current();
  const encryptedCredential=encryptScopedCredential(JSON.stringify(token),connectionCredentialContext({organizationId,provider:'teams',connectionId}));
  await prisma.$transaction(async tx=>{
   await current();
   const data={status:'pending',encryptedCredential,externalAccountId:tenant,scopesJson:grantedScopes,consentedByUserId:attempt.initiatedByUserId,consentedAt:new Date(),lastValidatedAt:null,revokedAt:null};
   if(existing){const changed=await tx.tenantIntegrationConnection.updateMany({where:{id:existing.id,organizationId,provider:'teams',status:existing.status,encryptedCredential:existing.encryptedCredential,updatedAt:existing.updatedAt,revokedAt:existing.revokedAt},data});if(changed.count!==1)throw new Error('connection_changed')}
   else await tx.tenantIntegrationConnection.create({data:{id:connectionId,organizationId,provider:'teams',...data}});
   await current();
  });
 }catch(error){return returnToCompanion(error instanceof AuthorityChanged?'authorization_required':error instanceof Error&&error.message==='connection_changed'?'connection_changed':'record_outcome_unknown','credential_store')}
 try{await recordAudit({organizationId:idFactory.organization(organizationId),actorUserId:idFactory.user(attempt.initiatedByUserId),actorKind:'user',action:'connector.connect',outcome:'success',entityRef:'connector:teams',correlationId:idFactory.correlation(`teams_consent_${Date.now().toString(36)}`),source:'live',detail:{scopeCount:grantedScopes.length,requestedScopeCount:3,validationRequired:true,validationMode:'identity_read'}})}catch{return returnToCompanion('record_outcome_unknown','audit')}
 return returnToCompanion('consent_recorded','complete');
}
