import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {connectionCredentialContext} from '@/lib/integrations/tenantAuthorization';
import {withGithubAbort,readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x20\x7f-\x9f]/.test(v));
export const jiraSelfIdentityBindingSchema=z.object({organizationId:identity,actorUserId:identity,sessionId:identity,connectionId:identity,connectionRevision:z.string().datetime()}).strict();
export type JiraSelfIdentityBinding=z.infer<typeof jiraSelfIdentityBindingSchema>;
const account=z.string().regex(/^[A-Za-z0-9:_-]{1,128}$/);
export const jiraSelfIdentitySnapshotSchema=jiraSelfIdentityBindingSchema.extend({authority:z.literal('authenticated_jira_self'),siteId:z.string().uuid(),accountId:account,displayName:z.string().min(1).max(200).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f-\x9f]/.test(v)),observedAt:z.string().datetime(),expiresAt:z.string().datetime()}).strict();
export type JiraSelfIdentitySnapshot=z.infer<typeof jiraSelfIdentitySnapshotSchema>;
const rowSchema=z.object({id:identity,organizationId:identity,provider:z.literal('jira'),status:z.literal('active'),revokedAt:z.null(),consentedByUserId:identity,externalAccountId:z.string().uuid(),updatedAt:z.date(),lastValidatedAt:z.date(),encryptedCredential:z.string().min(1).max(131072),scopesJson:z.array(z.enum(['read:jira-work','write:jira-work','offline_access','read:me'])).min(1).max(4)});
const actorSchema=z.object({organizationId:identity,userId:identity,sessionId:identity,canManageConnections:z.literal(true)}).strict();
const credentialSchema=z.object({accessToken:z.string().min(1).max(32768).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v)),expiresAt:z.number().int().safe(),cloudId:z.string().uuid()});
class ProfilePermissionRequired extends Error{}
export interface JiraSelfIdentityPorts{
 /** Trusted server composition only; no browser actor, credential, URL or scopes. */
 readActor?:()=>Promise<unknown>;
 readConnection?:(organizationId:string)=>Promise<unknown>;
 decrypt?:(encrypted:string,context:string)=>string;
 fetch?:typeof fetch;
 now?:()=>number;
}
/** Fixed read-only OAuth self identity, never a directory search or user grant.
 * No credential/profile persistence, refresh, additional permissions or writes.
 * User Identity API/read:me must be explicitly granted before this can succeed.
 * https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#how-do-i-retrieve-the-public-profile-of-the-authenticated-user
 */
export async function readJiraSelfIdentity(rawBinding:JiraSelfIdentityBinding,callerSignal:AbortSignal,ports:JiraSelfIdentityPorts={}):Promise<JiraSelfIdentitySnapshot>{
 const signal=AbortSignal.any([callerSignal,AbortSignal.timeout(10000)]);let response:Response|undefined;
 try{
  const b=jiraSelfIdentityBindingSchema.parse(rawBinding),clock=ports.now??Date.now;
  if(!ports.readActor||!ports.readConnection||!ports.decrypt||!ports.fetch)throw Error();
  const time=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)throw Error();return n};
  const currentActor=async()=>{signal.throwIfAborted();const actor=actorSchema.parse(await withGithubAbort(ports.readActor!(),signal));if(actor.organizationId!==b.organizationId||actor.userId!==b.actorUserId||actor.sessionId!==b.sessionId)throw Error();signal.throwIfAborted()};
  const read=async()=>{await currentActor();const row=rowSchema.parse(await withGithubAbort(ports.readConnection!(b.organizationId),signal));if(row.id!==b.connectionId||row.organizationId!==b.organizationId||row.consentedByUserId!==b.actorUserId||row.updatedAt.toISOString()!==b.connectionRevision||row.lastValidatedAt.getTime()>time()||time()-row.lastValidatedAt.getTime()>86400000||new Set(row.scopesJson).size!==row.scopesJson.length||!row.scopesJson.includes('read:jira-work'))throw Error();return row};
  const row=await read();if(!row.scopesJson.includes('read:me'))throw new ProfilePermissionRequired();
  const credential=credentialSchema.parse(JSON.parse(ports.decrypt(row.encryptedCredential,connectionCredentialContext({organizationId:b.organizationId,provider:'jira',connectionId:b.connectionId}))));
  if(credential.cloudId!==row.externalAccountId||credential.expiresAt<=time()+15000)throw Error();
  // Hash explicit ISO timestamps: canonical object hashing must not erase Dates.
  const stamp=(r:z.infer<typeof rowSchema>)=>sha256ContentHash({...r,updatedAt:r.updatedAt.toISOString(),lastValidatedAt:r.lastValidatedAt.toISOString()});
  const current=async()=>{const latest=await read();if(stamp(latest)!==stamp(row)||credential.expiresAt<=time()+15000)throw Error()};
  await current();
  const url='https://api.atlassian.com/me';response=await withGithubAbort(ports.fetch(url,{method:'GET',headers:{accept:'application/json',Authorization:`Bearer ${credential.accessToken}`},credentials:'omit',redirect:'error',cache:'no-store',signal}),signal);
  if(response.status!==200||response.redirected||response.url&&response.url!==url||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw Error();
  const profile=z.object({account_id:account,account_type:z.literal('atlassian'),account_status:z.literal('active'),name:jiraSelfIdentitySnapshotSchema.shape.displayName}).parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedGithubBody(response,signal,16384))));
  await current();const now=time();return jiraSelfIdentitySnapshotSchema.parse({...b,authority:'authenticated_jira_self',siteId:row.externalAccountId,accountId:profile.account_id,displayName:profile.name,observedAt:new Date(now).toISOString(),expiresAt:new Date(Math.min(now+300000,credential.expiresAt)).toISOString()});
 }catch(error){throw Error(error instanceof ProfilePermissionRequired?'jira_reporter_permission_required':'jira_reporter_identity_unavailable')}
 finally{void response?.body?.cancel().catch(()=>{})}
}
