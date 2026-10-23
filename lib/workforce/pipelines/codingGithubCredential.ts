import "server-only";
import { prisma } from "@/lib/db";
import { resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import type { RepoCoordinates } from "./parseRepoRef";
import { fetchFileContent } from "./githubWriteClient";

/** No environment token or owner impersonation fallback. */
export async function resolveCodingGithubCredential(organizationId: string, repository: RepoCoordinates) {
  return resolveTenantScopedToken(organizationId, repository).catch(() => ({ ok: false as const, error: "github_token_unavailable" as const }));
}

/** Re-resolve workspace authority before each required file read. */
export async function readCodingGithubFile(organizationId: string, repository: RepoCoordinates, path: string, ref: string) {
  const credential = await resolveCodingGithubCredential(organizationId, repository);
  if (!credential.ok) return { ok: false as const, reason: "fetch_failed" as const, detail: "Workspace GitHub connection is unavailable." };
  return fetchFileContent(repository.owner, repository.repo, path, ref, credential.token);
}

export type CodingWriteAuthority = {ok:true;resolveToken:()=>Promise<{ok:true;token:string}|{ok:false;error:string}>}|{ok:false;error:string};
/** Capture server-owned installation identity; every token resolution rechecks its revision. */
export async function createCodingWriteAuthority(organizationId: string,repository: RepoCoordinates): Promise<CodingWriteAuthority> {
  try {
    const row=await prisma.gitHubInstallation.findFirst({where:{organizationId,status:"active"},orderBy:{installedAt:"desc"},select:{id:true,githubInstallationId:true,updatedAt:true,revokedAt:true,suspendedAt:true}});
    if(!row || !row.id || !Number.isSafeInteger(Number(row.githubInstallationId)) || !/^[1-9][0-9]*$/.test(row.githubInstallationId) || !(row.updatedAt instanceof Date) || !Number.isFinite(row.updatedAt.getTime()) || row.revokedAt || row.suspendedAt)return {ok:false,error:"github_not_connected"};
    const id=row.id,githubInstallationId=row.githubInstallationId,version=row.updatedAt.getTime();
    const target=Object.freeze({owner:repository.owner,repo:repository.repo});
    return Object.freeze({ok:true,resolveToken:()=>resolveTenantScopedToken(organizationId,target,{id,githubInstallationId,updatedAt:new Date(version)}).catch(()=>({ok:false as const,error:"github_token_unavailable"}))});
  }catch{return {ok:false,error:"github_not_connected"};}
}
