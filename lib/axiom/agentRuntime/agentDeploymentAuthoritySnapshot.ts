import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
const id=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
const repository=z.object({id,organizationId:id,provider:z.literal('github'),remoteOwner:id,remoteName:id}).strict();
const policy=z.object({id,organizationId:id,repositoryId:id,environmentId:id,enabled:z.literal(true),branchPattern:z.string().min(1).max(1000),requireReleaseTag:z.boolean(),requireCodeowners:z.boolean(),requirePrLink:z.boolean(),requireChangeTicket:z.boolean(),requirePromotionFromEnvironmentId:id.nullable(),requireTestsPassing:z.boolean(),priority:z.number().int().safe()}).strict();
/** DB-only evidence, never admission. Call outside provider policy reads and
 * again in the final locked operation transaction. Bounded failures refuse. */
export async function readAgentDeploymentAuthoritySnapshot(repo:Pick<ReleaseOperationPlanTransaction,'$queryRaw'>,rawOrganizationId:string,rawEnvironmentId:string):Promise<string>{
 const organizationId=id.parse(rawOrganizationId),environmentId=id.parse(rawEnvironmentId);
 const repositories=await repo.$queryRaw`SELECT "id","organizationId","provider","remoteOwner","remoteName" FROM "Repository" WHERE "organizationId"=${organizationId} AND "provider"='github' ORDER BY "id" LIMIT 2001 FOR SHARE`;
 const policies=await repo.$queryRaw`SELECT p."id",p."organizationId",p."repositoryId",p."environmentId",p."enabled",p."branchPattern",p."requireReleaseTag",p."requireCodeowners",p."requirePrLink",p."requireChangeTicket",p."requirePromotionFromEnvironmentId",p."requireTestsPassing",p."priority" FROM "BranchEnvironmentPolicy" p JOIN "Repository" r ON r."id"=p."repositoryId" AND r."organizationId"=p."organizationId" WHERE p."organizationId"=${organizationId} AND p."environmentId"=${environmentId} AND p."enabled"=true AND r."provider"='github' ORDER BY p."id" LIMIT 2001 FOR SHARE OF p,r`;
 return agentDeploymentAuthoritySnapshotDigest(organizationId,environmentId,{repositories,policies});
}
/** Pure projection for evidence returned by the final single SQL snapshot. */
export function agentDeploymentAuthoritySnapshotDigest(rawOrganizationId:string,rawEnvironmentId:string,raw:unknown):string{
 const organizationId=id.parse(rawOrganizationId),environmentId=id.parse(rawEnvironmentId);
 const {repositories,policies}=z.object({repositories:z.array(repository).max(2000),policies:z.array(policy).max(2000)}).strict().parse(raw);
 const ids=new Set(repositories.map(r=>r.id));
 if(ids.size!==repositories.length||new Set(policies.map(p=>p.id)).size!==policies.length||repositories.some(r=>r.organizationId!==organizationId)||policies.some(p=>p.organizationId!==organizationId||p.environmentId!==environmentId||!ids.has(p.repositoryId)))throw Error('agent_deployment_policy_unavailable');
 return sha256ContentHash({organizationId,environmentId,repositories:[...repositories].sort((a,b)=>a.id.localeCompare(b.id)),policies:[...policies].sort((a,b)=>a.id.localeCompare(b.id))});
}
