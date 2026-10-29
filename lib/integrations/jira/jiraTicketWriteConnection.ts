import {jiraRecordedScopesSchema} from '@/lib/integrations/jira/jiraRecordedScopes';
import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {encryptScopedCredential} from '@/lib/security/credentialVault';
import {connectionCredentialContext} from '../tenantAuthorization';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {jiraTicketWriteBindingSchema,type JiraTicketWriteBinding} from './jiraTicketWriteAuthorization';
import type {JiraOAuthToken} from './jiraOAuth';
const id=z.string().min(1).max(512),secret=z.string().min(1).max(65536).refine(v=>!/[\x00-\x20\x7f]/.test(v));
const actorSchema=z.object({organizationId:id,userId:id,canManageConnections:z.literal(true)});
const scopesSchema=jiraRecordedScopesSchema.refine(s=>s.includes('read:jira-work')&&new Set(s).size===s.length);
const rowSchema=z.object({id,organizationId:id,provider:z.literal('jira'),status:z.literal('active'),revokedAt:z.null(),consentedByUserId:id,externalAccountId:z.string().uuid(),updatedAt:z.date(),scopesJson:scopesSchema,encryptedCredential:z.string().min(1).max(262144)});
const select={id:true,organizationId:true,provider:true,status:true,revokedAt:true,consentedByUserId:true,externalAccountId:true,updatedAt:true,scopesJson:true,encryptedCredential:true} as const;
interface Transaction{tenantIntegrationConnection:{findUnique(args:{where:{organizationId_provider:{organizationId:string;provider:'jira'}};select:typeof select}):Promise<unknown>;updateMany(args:{where:Record<string,unknown>;data:Record<string,unknown>}):Promise<{count:number}>};$queryRaw<T>(query:TemplateStringsArray,...values:unknown[]):Promise<T>}
export interface JiraTicketWriteRepository extends Transaction{$transaction<T>(work:(tx:Transaction)=>Promise<T>):Promise<T>}
export function createJiraTicketWriteConnection(repo:JiraTicketWriteRepository,ports:{readCurrentActor:()=>Promise<unknown>;readConfiguration:()=>{clientId:string;clientSecret:string;redirectUri:string};now?:()=>number;requireExistingWrite?:boolean}){
 const clock=ports.now??Date.now,fail=():never=>{throw Error('jira_ticket_write_connection_unavailable')};
 async function snapshot(tx:Pick<Transaction,'tenantIntegrationConnection'>,signal:AbortSignal){signal.throwIfAborted();const actor=actorSchema.parse(await withGithubAbort(ports.readCurrentActor(),signal)),row=rowSchema.parse(await withGithubAbort(tx.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:actor.organizationId,provider:'jira'}},select}),signal));
  if(ports.requireExistingWrite&&!row.scopesJson.includes('write:jira-work'))fail();
  if(row.organizationId!==actor.organizationId||row.consentedByUserId!==actor.userId||!Number.isFinite(row.updatedAt.getTime()))fail();
  const binding=jiraTicketWriteBindingSchema.parse({...ports.readConfiguration(),organizationId:actor.organizationId,userId:actor.userId,connectionId:row.id,connectionRevision:row.updatedAt.toISOString(),siteId:row.externalAccountId,credentialDigest:sha256ContentHash(row.encryptedCredential)});return{actor,row,binding};
 }
 return{
 async readBinding(signal:AbortSignal){try{return(await snapshot(repo,signal)).binding}catch{throw Error('jira_ticket_write_connection_unavailable')}},
 async persistUpgrade(rawBinding:Readonly<JiraTicketWriteBinding>,rawToken:Readonly<JiraOAuthToken>,signal:AbortSignal){let dispatched=false;try{const expected=jiraTicketWriteBindingSchema.parse(rawBinding),token=z.object({accessToken:secret,refreshToken:secret,expiresAt:z.number().int().safe(),scopes:scopesSchema}).strict().parse(rawToken);
  if(!token.scopes.includes('write:jira-work'))fail();
  return await withGithubAbort(repo.$transaction(async tx=>{
   const before=await snapshot(tx,signal);if(sha256ContentHash(before.binding)!==sha256ContentHash(expected))fail();
   const members=await withGithubAbort(tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null}>>`SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${expected.organizationId} AND "userId"=${expected.userId} FOR SHARE`,signal);
   if(members.length!==1||members[0].organizationId!==expected.organizationId||members[0].userId!==expected.userId||!members[0].acceptedAt||!['owner','admin'].includes(members[0].role))fail();
   const latest=await snapshot(tx,signal);if(sha256ContentHash(latest.binding)!==sha256ContentHash(expected))fail();const time=clock();if(!Number.isSafeInteger(time)||time<0||token.expiresAt<=time||token.expiresAt>time+86400000)fail();
   const encryptedCredential=z.string().min(1).max(262144).parse(encryptScopedCredential(JSON.stringify({accessToken:token.accessToken,refreshToken:token.refreshToken,expiresAt:token.expiresAt,cloudId:expected.siteId}),connectionCredentialContext({organizationId:expected.organizationId,provider:'jira',connectionId:expected.connectionId})));
   const row=latest.row;signal.throwIfAborted();dispatched=true;const result=await withGithubAbort(tx.tenantIntegrationConnection.updateMany({where:{id:row.id,organizationId:row.organizationId,provider:'jira',status:'active',revokedAt:null,consentedByUserId:expected.userId,externalAccountId:expected.siteId,updatedAt:row.updatedAt,encryptedCredential:row.encryptedCredential,scopesJson:{equals:row.scopesJson}},data:{status:'active',encryptedCredential,scopesJson:token.scopes,lastValidatedAt:new Date(time),updatedAt:new Date(Math.max(time,row.updatedAt.getTime()+1))}}),signal);
   if(result.count===0){dispatched=false;fail()}if(result.count!==1)fail();signal.throwIfAborted();return{connectionId:row.id};
  }),signal);
 }catch{throw Error(dispatched?'jira_ticket_write_record_outcome_unknown':'jira_ticket_write_connection_unavailable')}}
 };
}
