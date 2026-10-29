import type {CloudOAuthProvider} from './authorization';
export interface CloudReadPort {
 /** Runtime must use bounded provider I/O, reject redirects, omit cookies and disable caching. */
 read(url:string,init:RequestInit):Promise<{ok:boolean;status:number;json:unknown}>;
}
export interface VerifiedCloudResource {provider:CloudOAuthProvider;resourceId:string;resourceReadVerified:true}
/** Fixed GET only. Resource access is distinct from identity login and never implies
 * complete inventory, Reader-only IAM, credential persistence, or deployment permission. */
export async function verifyCloudResource(input:{provider:CloudOAuthProvider;resourceId:string;accessToken:string;signal:AbortSignal},io:CloudReadPort):Promise<VerifiedCloudResource>{
 input.signal.throwIfAborted();
 const valid=input.provider==='gcp'?/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(input.resourceId):input.provider==='azure'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.resourceId);
 if(!valid||!input.accessToken||input.accessToken.length>16384||/[\s\u0000-\u001f\u007f-\u009f]/.test(input.accessToken))throw new Error('cloud_resource_invalid');
 const url=input.provider==='gcp'?`https://cloudresourcemanager.googleapis.com/v1/projects/${input.resourceId}`:`https://management.azure.com/subscriptions/${input.resourceId}?api-version=2022-12-01`;
 const response=await io.read(url,{method:'GET',headers:{Authorization:`Bearer ${input.accessToken}`},signal:input.signal,redirect:'error',credentials:'omit',cache:'no-store'});
 input.signal.throwIfAborted();
 if(!response.ok)throw new Error(response.status===401||response.status===403?'cloud_resource_denied':'cloud_resource_unavailable');
 const body=response.json;
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('cloud_resource_unverified');
 const value=body as Record<string,unknown>;
 if(input.provider==='gcp'?(value.projectId!==input.resourceId||value.lifecycleState!=='ACTIVE'):(value.subscriptionId!==input.resourceId||value.state!=='Enabled'))throw new Error('cloud_resource_unverified');
 return{provider:input.provider,resourceId:input.resourceId,resourceReadVerified:true};
}
