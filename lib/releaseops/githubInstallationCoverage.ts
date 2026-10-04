/**
 * Live check: is a given repository actually covered by this
 * organization's active GitHub App installation?
 *
 * Used before binding a Release to a Repository as its evidence source
 * (see releaseCreateResponder.ts / app/api/dashboard/release-create).
 * Registering a Repository row today (repositoryCreateResponder.ts) is
 * purely self-reported — provider/owner/name are typed in with no check
 * against GitHub at all. This module is the first place that actually
 * verifies the claim: minting a repository-scoped installation token
 * fails (422) if the repository isn't in the installation's selection,
 * which is the same signal app/api/desktop/deployments/[id]/github-evidence
 * already relies on for the identical purpose.
 *
 * This is deliberately NOT folded into releaseCreateResponder.ts — that
 * responder is a DB-only pure-ish kernel (testable with an in-memory
 * repo stub, no network). Live GitHub calls are an IO boundary concern
 * and belong in the route, composed with this helper.
 */

import "server-only";

import { resolveGithubInstallationToken } from "@/lib/connectors/github/githubAppAuth";

export interface InstallationRepo {
  gitHubInstallation: {
    findFirst(args: {
      where: { organizationId: string; status: "active" };
      orderBy: { installedAt: "desc" };
      select: { githubInstallationId: true };
    }): Promise<{ githubInstallationId: string } | null>;
  };
}

export type CoverageResult =
  | { ok: true }
  | { ok: false; reason: "github_not_connected" | "repository_not_in_installation" | "github_validation_unavailable" };

/**
 * `repositoryRemoteName` must be the bare repo name (e.g. "checkout-api"),
 * not "owner/repo" — matches resolveGithubInstallationToken's contract.
 */
export async function verifyRepositoryCoveredByInstallation(
  repo: InstallationRepo,
  organizationId: string,
  repositoryRemoteName: string,
): Promise<CoverageResult> {
  const installation = await repo.gitHubInstallation
    .findFirst({
      where: { organizationId, status: "active" },
      orderBy: { installedAt: "desc" },
      select: { githubInstallationId: true },
    })
    .catch(() => null);
  if (!installation) return { ok: false, reason: "github_not_connected" };

  const installationId = Number(installation.githubInstallationId);
  if (!Number.isSafeInteger(installationId)) return { ok: false, reason: "github_not_connected" };

  const token = await resolveGithubInstallationToken({
    installationId,
    repositories: [repositoryRemoteName],
  });
  if (!token.ok) {
    // github.app_installation_not_found / github.app_token_failed etc. are
    // infra-unavailable, not proof the repo is excluded — but
    // github.app_invalid_repository_scope and a flat-out mint rejection are
    // exactly what "not in this installation's selection" looks like. We
    // don't have finer-grained signal than ok/not-ok from this call today,
    // so fail closed to the safer (more honest) "not verified" outcome
    // either way rather than guessing which case it was.
    return { ok: false, reason: "repository_not_in_installation" };
  }
  return { ok: true };
}
