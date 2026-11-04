/**
 * Shared tenant-repo-scoped installation token resolver.
 *
 * Every write route (branch create, file commit, pull request, clone
 * token) needs the exact same two checks before touching GitHub: (1) the
 * calling tenant actually has an active GitHub App installation, and (2)
 * the token minted for this call is scoped to exactly the one repository
 * requested — never a blanket, unscoped token. GitHub's own API enforces
 * scope at the token level (resolveGithubInstallationToken's
 * `repositories` option), so a bug here can't silently widen access to a
 * repo outside the requested one; this function just makes sure every
 * caller goes through the same tenant-ownership lookup instead of
 * re-deriving it four times.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { resolveGithubInstallationToken, type GithubReadPermissionProfile } from "./githubAppAuth";

import {parseRepositoryFullName,type RepoRef} from "./repositoryFullName";
export {parseRepositoryFullName,type RepoRef} from "./repositoryFullName";

export type ResolveTenantScopedTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: "github_not_connected" | "github_token_unavailable" };

export interface InstallationRepo {
  gitHubInstallation: {
    findFirst(args: {
      where: { organizationId: string; status: string };
      orderBy: { installedAt: "desc" };
      select: { githubInstallationId: true; id?: true; updatedAt?: true; revokedAt?: true; suspendedAt?: true };
    }): Promise<{ githubInstallationId: string; id?: string; updatedAt?: Date; revokedAt?: Date | null; suspendedAt?: Date | null } | null>;
  };
}

/**
 * Resolves an installation access token scoped to exactly `repo`,
 * verified to belong to the calling organization's own active GitHub App
 * installation. `repo` must be the bare repository name (no owner
 * prefix) — matching what resolveGithubInstallationToken's `repositories`
 * option expects.
 */
export interface ExpectedTenantInstallation {
  id: string;
  githubInstallationId: string;
  updatedAt: Date;
  signal?: AbortSignal;
  permissionProfile?: GithubReadPermissionProfile;
}
export type ResolveTenantScopedTokenWithExpiryResult =
  | { ok: true; token: string; expiresAt: number }
  | Extract<ResolveTenantScopedTokenResult,{ok:false}>;
type ValidatedTokenResult =
  | { ok: true; token: string; expiresAt?: number }
  | Extract<ResolveTenantScopedTokenResult,{ok:false}>;

/** Shared single issuance path. Capture caller-owned scope/profile primitives
 * before the first database/provider await; never switch profiles after mint. */
async function resolveValidatedTenantToken(organizationId:string,repo:RepoRef,expectedInstallation:ExpectedTenantInstallation|undefined,installationRepo:InstallationRepo,requireExpiry:boolean):Promise<ValidatedTokenResult>{
  const unavailable=():ValidatedTokenResult=>({ok:false,error:'github_token_unavailable'});
  const target={owner:repo.owner,repo:repo.repo};
  const signal=expectedInstallation?.signal,permissionProfile=expectedInstallation?.permissionProfile;
  const pinned=expectedInstallation?{id:expectedInstallation.id,githubInstallationId:expectedInstallation.githubInstallationId,updatedAt:expectedInstallation.updatedAt instanceof Date?expectedInstallation.updatedAt.getTime():NaN}:null;
  if(signal?.aborted)return unavailable();
  if(requireExpiry&&(!pinned||typeof pinned.id!=='string'||!pinned.id||!Number.isFinite(pinned.updatedAt)||!/^[1-9][0-9]*$/.test(pinned.githubInstallationId)||!Number.isSafeInteger(Number(pinned.githubInstallationId))||!parseRepositoryFullName(`${target.owner}/${target.repo}`)))return unavailable();
  if(permissionProfile!==undefined&&!['provenance_read','contents_read','pull_requests_read'].includes(permissionProfile))return unavailable();
  const readInstallation=()=>installationRepo.gitHubInstallation.findFirst({
    where:{organizationId,status:'active'},orderBy:{installedAt:'desc'},
    select:pinned?{githubInstallationId:true,id:true,updatedAt:true,revokedAt:true,suspendedAt:true}:{githubInstallationId:true},
  }).catch(()=>null);
  const matches=(row:Awaited<ReturnType<typeof readInstallation>>)=>!!row&&(!pinned||(
    row.id===pinned.id&&row.githubInstallationId===pinned.githubInstallationId&&row.updatedAt?.getTime()===pinned.updatedAt&&!row.revokedAt&&!row.suspendedAt
  ));
  const installation=await readInstallation();
  if(!installation||!matches(installation))return{ok:false,error:'github_not_connected'};
  if(signal?.aborted)return unavailable();
  const installationId=Number(installation.githubInstallationId);
  const outcome=await resolveGithubInstallationToken({installationId,repositories:[target.repo],...(signal?{signal}:{}),...(permissionProfile?{permissionProfile}:{})});
  if(signal?.aborted||!outcome.ok)return unavailable();
  if(pinned&&outcome.installationId!==installationId)return unavailable();
  // Only real provider/cache metadata can establish the lease. Legacy consumers
  // retain their old response shape and do not acquire a guessed expiry.
  const expiresAt=outcome.expiresAt;
  const liveExpiry=()=>typeof expiresAt==='number'&&Number.isFinite(expiresAt)&&Number.isFinite(Date.now())&&expiresAt>Date.now();
  if(requireExpiry&&!liveExpiry())return unavailable();
  if(pinned&&!matches(await readInstallation()))return{ok:false,error:'github_not_connected'};
  if(signal?.aborted||requireExpiry&&!liveExpiry())return unavailable();
  return{ok:true,token:outcome.token,expiresAt};
}

/** Compatibility projection: no expiry field is added to existing results. */
export async function resolveTenantScopedToken(organizationId:string,repo:RepoRef,expectedInstallation?:ExpectedTenantInstallation,installationRepo:InstallationRepo=prisma as unknown as InstallationRepo):Promise<ResolveTenantScopedTokenResult>{
  const result=await resolveValidatedTenantToken(organizationId,repo,expectedInstallation,installationRepo,false);
  return result.ok?{ok:true,token:result.token}:result;
}

/** Explicit lease metadata for trusted pinned issuance. Missing or stale provider
 * expiry refuses; no second mint, ambient fallback or synthetic lifetime exists. */
export async function resolveTenantScopedTokenWithExpiry(organizationId:string,repo:RepoRef,expectedInstallation:ExpectedTenantInstallation,installationRepo:InstallationRepo=prisma as unknown as InstallationRepo):Promise<ResolveTenantScopedTokenWithExpiryResult>{
  try{
    const result=await resolveValidatedTenantToken(organizationId,repo,expectedInstallation,installationRepo,true);
    if(!result.ok)return result;
    if(typeof result.expiresAt!=='number')return{ok:false,error:'github_token_unavailable'};
    return{ok:true,token:result.token,expiresAt:result.expiresAt};
  }catch{return{ok:false,error:'github_token_unavailable'}}
}
