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
import { resolveGithubInstallationToken } from "./githubAppAuth";

export interface RepoRef {
  owner: string;
  repo: string;
}

export type ResolveTenantScopedTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: "github_not_connected" | "github_token_unavailable" };

interface InstallationRepo {
  gitHubInstallation: {
    findFirst(args: {
      where: { organizationId: string; status: string };
      orderBy: { installedAt: "desc" };
      select: { githubInstallationId: true };
    }): Promise<{ githubInstallationId: string } | null>;
  };
}

/**
 * Resolves an installation access token scoped to exactly `repo`,
 * verified to belong to the calling organization's own active GitHub App
 * installation. `repo` must be the bare repository name (no owner
 * prefix) — matching what resolveGithubInstallationToken's `repositories`
 * option expects.
 */
export async function resolveTenantScopedToken(organizationId: string, repo: RepoRef): Promise<ResolveTenantScopedTokenResult> {
  const installation = await (prisma as unknown as InstallationRepo).gitHubInstallation.findFirst({
    where: { organizationId, status: "active" },
    orderBy: { installedAt: "desc" },
    select: { githubInstallationId: true },
  }).catch(() => null);
  if (!installation) return { ok: false, error: "github_not_connected" };

  const installationId = Number(installation.githubInstallationId);
  const outcome = await resolveGithubInstallationToken({ installationId, repositories: [repo.repo] });
  if (!outcome.ok) return { ok: false, error: "github_token_unavailable" };
  return { ok: true, token: outcome.token };
}

/** Splits "owner/repo" into its parts. Returns null for anything else. */
export function parseRepositoryFullName(fullName: string): RepoRef | null {
  const parts = fullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}
