import 'server-only';
import {z} from 'zod';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {identifier} from './contracts';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const scopeInput=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
type Scope=z.infer<typeof scopeInput>;
const github=z.object({id:identifier,organizationId:identifier,accountLogin:z.string().min(1).max(160),updatedAt:z.date(),status:z.literal('active'),revokedAt:z.null(),suspendedAt:z.null()}).passthrough();
const aws=z.object({id:identifier,organizationId:identifier,externalAccountId:z.string().regex(/^\d{12}$/),regions:z.array(z.string().regex(/^[a-z]{2}(?:-[a-z]+)+-\d$/)).min(1).max(100),updatedAt:z.date(),credentialVersion:z.number().int().positive()}).passthrough();
/** Configured-source metadata only. No token, encrypted payload or provider call.
 * Membership/capabilities are mandatory trusted server ports, not request flags. */
export function createGovernanceSourceDirectory(repo:ReleaseOperationPlanRepo,ports:{assertCurrent:(tx:Tx,s:Scope)=>Promise<void>}){return{
 async list(raw:Scope){const s=scopeInput.parse(raw);if(typeof ports.assertCurrent!=='function')throw Error('governance_source_directory_unavailable');return repo.$transaction(async tx=>{
  await ports.assertCurrent(tx,s);
  const rawGithub=z.array(z.unknown()).max(21).parse(await tx.$queryRaw`SELECT "id","organizationId","accountLogin","updatedAt","status","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "organizationId"=${s.organizationId} AND "status"='active' AND "revokedAt" IS NULL AND "suspendedAt" IS NULL ORDER BY "id" LIMIT 21 FOR SHARE`);
  const rawAws=z.array(z.unknown()).max(21).parse(await tx.$queryRaw`SELECT a."id",a."organizationId",a."externalAccountId",a."regions",a."updatedAt",c."version" AS "credentialVersion" FROM "CloudAccount" a JOIN "CloudAccountCredential" c ON c."id"=a."id" AND c."organizationId"=a."organizationId" WHERE a."organizationId"=${s.organizationId} AND a."provider"='aws' AND a."enabled"=true AND a."credentialRef"='cloud-v2:' || a."id" AND c."revokedAt" IS NULL ORDER BY a."id" LIMIT 21 FOR SHARE OF a,c`);
  const owned=z.object({organizationId:identifier}).passthrough();
  if([...rawGithub,...rawAws].some(row=>owned.parse(row).organizationId!==s.organizationId))throw Error('governance_source_directory_unavailable');
  const gp=rawGithub.map(row=>github.safeParse(row)),ap=rawAws.map(row=>aws.safeParse(row)),g=gp.flatMap(v=>v.success?[v.data]:[]),a=ap.flatMap(v=>v.success?[v.data]:[]);
  const unavailable=[...(gp.some(v=>!v.success)?[{source:'github' as const,reason:'configuration_unavailable' as const}]:[]),...(ap.some(v=>!v.success)?[{source:'aws' as const,reason:'configuration_unavailable' as const}]:[])];
  await ports.assertCurrent(tx,s);
  return{unavailable,items:[...g.slice(0,20).map(row=>({source:'github' as const,connectionId:row.id,connectionRevision:row.updatedAt.toISOString(),label:row.accountLogin})),...a.slice(0,20).map(row=>({source:'aws' as const,connectionId:row.id,connectionRevision:sha256ContentHash({accountId:row.id,updatedAt:row.updatedAt.toISOString(),credentialVersion:row.credentialVersion}),label:row.externalAccountId,accountId:row.externalAccountId,regions:[...new Set(row.regions)]}))],truncated:rawGithub.length>20||rawAws.length>20};
 })}
}};
