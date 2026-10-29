import {createHash} from 'node:crypto';
import {buildCloudAuthorization,type CloudOAuthProvider} from './authorization';
import type {VerifiedCloudResource} from './resourceVerification';
export interface CloudCallbackInput{
 provider:CloudOAuthProvider;organizationId:string;userId:string;sessionId:string;
 state:string;code:string;redirectUri:string;resourceId:string;signal:AbortSignal;tenantId?:string;
}
export interface CloudOAuthTokens {accessToken:string;refreshToken:string;tokenType:string;expiresIn:number;scopes:string[]}
type Binding=Pick<CloudCallbackInput,'provider'|'organizationId'|'userId'|'sessionId'|'redirectUri'|'resourceId'|'tenantId'>;
export interface CloudCallbackPorts{
 /** Atomic, expiring, single-use claim. Must bind every field to the original
  * server-created attempt and current browser owner. Verifier is decrypted only
  * after claim. It must not be persisted as plaintext or accepted from the client. */
 claim(input:Binding&{stateDigest:string}):Promise<{id:string;verifier:string}|null>;
 assertAuthority(input:Binding):Promise<void>;
 /** Fixed provider endpoint, PKCE and bounded transport; never automatically retry. */
 exchange(input:Binding&{attemptId:string;code:string;verifier:string;signal:AbortSignal}):Promise<CloudOAuthTokens>;
 verifyResource(input:{provider:CloudOAuthProvider;resourceId:string;accessToken:string;signal:AbortSignal}):Promise<VerifiedCloudResource>;
 /** Transaction must recheck paired session/membership and expected attempt, encrypt
  * credentials with tenant/provider/connection binding and persist only read access.
  * It must reject changed/replayed authority, never overwrite a later connection.
  * A lost acknowledgement is recovered by status read, not another exchange/save. */
 saveVerifiedConnection(input:Binding&{attemptId:string;resource:VerifiedCloudResource;tokens:CloudOAuthTokens;signal:AbortSignal}):Promise<{id:string;version:number}>;
}
function tokenVerified(tokens:CloudOAuthTokens,provider:CloudOAuthProvider):boolean{
 const secret=(s:unknown)=>typeof s==='string'&&s.length>0&&s.length<=16384&&!/[\s\u0000-\u001f\u007f-\u009f]/.test(s);
 if(!tokens||tokens.tokenType?.toLowerCase()!=='bearer'||!secret(tokens.accessToken)||!secret(tokens.refreshToken)||!Number.isSafeInteger(tokens.expiresIn)||tokens.expiresIn<1||tokens.expiresIn>86400||!Array.isArray(tokens.scopes)||!tokens.scopes.length)return false;
 const metadata=new Set(['openid','offline_access','profile','email']);
 const required=provider==='gcp'?'https://www.googleapis.com/auth/cloud-platform.read-only':'https://management.azure.com/user_impersonation';
 return tokens.scopes.includes(required)&&tokens.scopes.every(scope=>scope===required||metadata.has(scope));
}
/** Automatic callback logic with no browser-provided success flag and no manual
 * Verify action. Runtime route/atomic persistence adapters are separately required.
 * This module itself never performs provider I/O or claims a saved connection. */
export async function finishCloudAuthorization(input:CloudCallbackInput,ports:CloudCallbackPorts):Promise<{status:'connected_read_only';connectionId:string;version:number;deploymentAvailable:false}>{
 input.signal.throwIfAborted();
 const identity=[input.organizationId,input.userId,input.sessionId];
 if(identity.some(s=>typeof s!=='string'||!s.trim()||s.length>512||/[\u0000-\u001f\u007f]/.test(s))||typeof input.code!=='string'||!input.code||new TextEncoder().encode(input.code).length>16384||/[\s\u0000-\u001f\u007f-\u009f]/.test(input.code)||typeof input.resourceId!=='string'||!input.resourceId)throw new Error('cloud_callback_invalid');
 // Reuse the exact provider/callback/state validator before consuming anything.
 try{buildCloudAuthorization({provider:input.provider,clientId:'validation-only',redirectUri:input.redirectUri,state:input.state,verifier:'v'.repeat(64),tenantId:input.tenantId})}catch{throw new Error('cloud_callback_invalid')}
 const binding:Binding={provider:input.provider,organizationId:input.organizationId,userId:input.userId,sessionId:input.sessionId,redirectUri:input.redirectUri,resourceId:input.resourceId,...(input.provider==='azure'?{tenantId:input.tenantId}:{})};
 const authority=async()=>{input.signal.throwIfAborted();try{await ports.assertAuthority(binding)}catch{throw new Error('cloud_authorization_required')}input.signal.throwIfAborted()};
 await authority();
 let attempt:{id:string;verifier:string}|null;
 try{attempt=await ports.claim({...binding,stateDigest:createHash('sha256').update(input.state).digest('hex')})}catch{throw new Error('cloud_authorization_unconfirmed')}
 input.signal.throwIfAborted();
 if(!attempt||!attempt.id||!/^[A-Za-z0-9._~-]{43,128}$/.test(attempt.verifier))throw new Error('cloud_authorization_invalid');
 await authority();
 let tokens:CloudOAuthTokens;
 try{tokens=await ports.exchange({...binding,attemptId:attempt.id,code:input.code,verifier:attempt.verifier,signal:input.signal})}catch{throw new Error('cloud_exchange_unconfirmed')}
 input.signal.throwIfAborted();
 if(!tokenVerified(tokens,input.provider))throw new Error('cloud_token_unverified');
 await authority();
 let resource:VerifiedCloudResource;
 try{resource=await ports.verifyResource({provider:input.provider,resourceId:input.resourceId,accessToken:tokens.accessToken,signal:input.signal})}catch{throw new Error('cloud_resource_unverified')}
 input.signal.throwIfAborted();
 if(!resource||resource.provider!==input.provider||resource.resourceId!==input.resourceId||resource.resourceReadVerified!==true)throw new Error('cloud_resource_unverified');
 await authority();
 let saved:{id:string;version:number};
 try{saved=await ports.saveVerifiedConnection({...binding,attemptId:attempt.id,resource,tokens,signal:input.signal})}catch{throw new Error('cloud_save_unconfirmed')}
 input.signal.throwIfAborted();
 if(!saved?.id||!Number.isSafeInteger(saved.version)||saved.version<1)throw new Error('cloud_save_unconfirmed');
 return{status:'connected_read_only',connectionId:saved.id,version:saved.version,deploymentAvailable:false};
}
