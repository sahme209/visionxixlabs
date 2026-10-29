import {createHash} from 'node:crypto';

export type CloudOAuthProvider = 'azure' | 'gcp';
export interface CloudAuthorizationInput {
 provider: CloudOAuthProvider;
 clientId: string;
 redirectUri: string;
 state: string;
 verifier: string;
 tenantId?: string;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Pure URL construction. This neither creates consent nor enrolls a cloud account.
 * Dedicated cloud registrations are required; Teams/Google identity login is not ARM/GCP access.
 * ARM's delegated scope carries the user's effective rights, not a Reader-only grant.
 * Axiom's adapter must expose bounded reads only; deployment requires separate authority.
 */
export function buildCloudAuthorization(input: CloudAuthorizationInput): string {
 if(!['azure','gcp'].includes(input.provider)||!input.clientId.trim()||input.clientId.length>512||/[\s\u0000-\u001f\u007f]/.test(input.clientId)||!/^[A-Za-z0-9_-]{43,128}$/.test(input.state)||!/^[A-Za-z0-9._~-]{43,128}$/.test(input.verifier))throw new Error('cloud_authorization_invalid');
 const callback=new URL(input.redirectUri);
 if(callback.origin!=='https://visionxixlabs.com'||callback.username||callback.password||callback.search||callback.hash||callback.pathname!==`/api/integrations/${input.provider}-cloud/callback`)throw new Error('cloud_callback_untrusted');
 if(input.provider==='azure'&&(!input.tenantId||!uuid.test(input.tenantId)))throw new Error('azure_tenant_required');
 const url=new URL(input.provider==='gcp'?'https://accounts.google.com/o/oauth2/v2/auth':`https://login.microsoftonline.com/${input.tenantId}/oauth2/v2.0/authorize`);
 url.search=new URLSearchParams({client_id:input.clientId,response_type:'code',redirect_uri:input.redirectUri,state:input.state,code_challenge:createHash('sha256').update(input.verifier).digest('base64url'),code_challenge_method:'S256',...(input.provider==='gcp'?{scope:'https://www.googleapis.com/auth/cloud-platform.read-only',access_type:'offline',include_granted_scopes:'false',prompt:'consent select_account'}:{scope:'offline_access https://management.azure.com/user_impersonation',response_mode:'query',prompt:'select_account'})}).toString();
 return url.toString();
}
export interface CloudConnectionProof {
 provider: 'aws'|'azure'|'gcp';
 expectedResourceId: string;
 observedResourceId: string;
 currentAuthority: boolean;
 selectedResource: boolean;
 credentialSaved: boolean;
 resourceReadVerified: boolean;
}
/** Presentation result only. Proof must come from a trusted server operation,
 * never from a browser body. This is not an authorization or execution grant. */
export function cloudConnectionOutcome(proof:CloudConnectionProof):{status:'connected_read_only'|'authorization_required'|'selection_required'|'resource_mismatch'|'verification_required'|'save_required';deploymentAvailable:false} {
 let status:ReturnType<typeof cloudConnectionOutcome>['status'];
 if(!proof.currentAuthority)status='authorization_required';
 else if(!proof.selectedResource)status='selection_required';
 else if(!proof.expectedResourceId.trim()||proof.expectedResourceId!==proof.observedResourceId)status='resource_mismatch';
 else if(!proof.resourceReadVerified)status='verification_required';
 else if(!proof.credentialSaved)status='save_required';
 else status='connected_read_only';
 return {status,deploymentAvailable:false};
}
