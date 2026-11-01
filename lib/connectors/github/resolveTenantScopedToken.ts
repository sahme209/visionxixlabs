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

export interface RepoRef {
  owner: string;
  repo: string;
}

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
export async function resolveTenantScopedToken(organizationId: string, repo: RepoRef,
  expectedInstallation?: { id: string; githubInstallationId: string; updatedAt: Date; signal?: AbortSignal; permissionProfile?: GithubReadPermissionProfile },
  installationRepo: InstallationRepo = prisma as unknown as InstallationRepo,
): Promise<ResolveTenantScopedTokenResult> {
  // Capture primitive revision values before the provider await. A mutable
  // caller object cannot move the expected installation while minting.
  const pinned = expectedInstallation ? {
    id: expectedInstallation.id,
    githubInstallationId: expectedInstallation.githubInstallationId,
    updatedAt: expectedInstallation.updatedAt.getTime(),
  } : null;
  const signal = expectedInstallation?.signal;
  if (signal?.aborted) return { ok: false, error: "github_token_unavailable" };
  const readInstallation = () => installationRepo.gitHubInstallation.findFirst({
    where: { organizationId, status: "active" },
    orderBy: { installedAt: "desc" },
    select: pinned ? { githubInstallationId: true, id: true, updatedAt: true, revokedAt: true, suspendedAt: true } : { githubInstallationId: true },
  }).catch(() => null);
  const matches = (row: Awaited<ReturnType<typeof readInstallation>>) => !!row && (!pinned || (
    row.id === pinned.id && row.githubInstallationId === pinned.githubInstallationId
    && row.updatedAt?.getTime() === pinned.updatedAt && !row.revokedAt && !row.suspendedAt
  ));
  const installation = await readInstallation();
  if (!installation || !matches(installation)) return { ok: false, error: "github_not_connected" };
  if (signal?.aborted) return { ok: false, error: "github_token_unavailable" };

  const installationId = Number(installation.githubInstallationId);
  const outcome = await resolveGithubInstallationToken({ installationId, repositories: [repo.repo], ...(expectedInstallation?.signal ? { signal: expectedInstallation.signal } : {}), ...(expectedInstallation?.permissionProfile ? { permissionProfile: expectedInstallation.permissionProfile } : {}) });
  if (signal?.aborted) return { ok: false, error: "github_token_unavailable" };
  if (!outcome.ok) return { ok: false, error: "github_token_unavailable" };
  if (expectedInstallation && outcome.installationId !== installationId) return { ok: false, error: "github_token_unavailable" };
  if (pinned && !matches(await readInstallation())) return { ok: false, error: "github_not_connected" };
  if (signal?.aborted) return { ok: false, error: "github_token_unavailable" };
  return { ok: true, token: outcome.token };
}

/** Splits "owner/repo" into its parts. Returns null for anything else. */
export function parseRepositoryFullName(fullName: string): RepoRef | null {
  const parts = fullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const safeName = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
  if (!safeName.test(parts[0]) || !safeName.test(parts[1])) return null;
  return { owner: parts[0], repo: parts[1] };
}
