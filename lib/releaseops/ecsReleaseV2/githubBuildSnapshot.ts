import "server-only";
import type { PrismaClient } from "@prisma/client";
import { readPostgresReviewPolicy } from "./postgresReviewStore";
import type { GithubBuildScope, GithubBuildRequest, GithubBuildSnapshot } from "./githubBuildEvidence";

export type GithubBuildSnapshotClient = Pick<PrismaClient, "$transaction">;

/** Existing tenant/configuration tables only, in one bounded read-only transaction.
 * No review packet, credential, quota, target, audit or provider state is written. */
export async function readGithubBuildSnapshot(client: GithubBuildSnapshotClient, scope: GithubBuildScope, request: GithubBuildRequest): Promise<GithubBuildSnapshot | null> {
  return client.$transaction(async tx => {
    const membership = await tx.orgMembership.findUnique({ where: { userId_organizationId: scope }, select: { id: true, organizationId: true, userId: true, role: true, acceptedAt: true, updatedAt: true } });
    if (!membership?.acceptedAt || !["owner", "admin"].includes(membership.role)) return null;
    const [repository, environment, installation, policy] = await Promise.all([
      tx.repository.findFirst({ where: { id: request.repositoryRecordId, organizationId: scope.organizationId, provider: "github" }, select: { id: true, organizationId: true, provider: true, remoteOwner: true, remoteName: true, updatedAt: true } }),
      tx.environment.findFirst({ where: { id: request.environmentId, organizationId: scope.organizationId }, select: { id: true, organizationId: true, approvalPolicyId: true, updatedAt: true } }),
      tx.gitHubInstallation.findFirst({ where: { organizationId: scope.organizationId, status: "active" }, orderBy: { installedAt: "desc" }, select: { id: true, organizationId: true, githubInstallationId: true, accountLogin: true, status: true, installedAt: true, updatedAt: true, revokedAt: true, suspendedAt: true } }),
      readPostgresReviewPolicy(tx, scope.organizationId, request.environmentId),
    ]);
    if (!repository || !environment?.approvalPolicyId || !installation || !policy) return null;
    const branchPolicies = await tx.branchEnvironmentPolicy.findMany({ where: { organizationId: scope.organizationId, repositoryId: repository.id, environmentId: environment.id, enabled: true }, orderBy: [{ priority: "asc" }, { id: "asc" }], take: 101,
      select: { id: true, organizationId: true, repositoryId: true, environmentId: true, branchPattern: true, priority: true, requireReleaseTag: true, requireCodeowners: true, requirePrLink: true, requireChangeTicket: true, requirePromotionFromEnvironmentId: true, requireTestsPassing: true, enabled: true, updatedAt: true } });
    if (branchPolicies.length > 100) return null;
    // Convert dates explicitly through JSON; the canonical digest must include revisions, not Date's empty enumerable keys.
    return JSON.parse(JSON.stringify({ membership, repository, environment, installation, policy, branchPolicies })) as GithubBuildSnapshot;
  }, { isolationLevel: "Serializable", maxWait: 3_000, timeout: 5_000 });
}
