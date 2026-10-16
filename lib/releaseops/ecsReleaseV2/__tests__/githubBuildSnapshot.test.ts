import { expect, it, vi } from "vitest";
import { readGithubBuildSnapshot, type GithubBuildSnapshotClient } from "../githubBuildSnapshot";
import { evidenceDigest } from "../contract";
import type { GithubBuildRequest } from "../githubBuildEvidence";
const date = new Date("2026-10-16T00:00:00Z"), scope = { organizationId: "org", userId: "admin" };
const request: GithubBuildRequest = { repositoryRecordId: "repo", environmentId: "env", policyDigest: `sha256:${"a".repeat(64)}`,
  expected: { repositoryId: "123", repositoryFullName: "owner/repo", sourceSha: "a".repeat(40), workflowSha: "a".repeat(40), workflowPath: ".github/workflows/build.yml", runId: "1", runAttempt: 1, attestationDigest: `sha256:${"b".repeat(64)}`, subjects: [{ name: "registry.test/app", sha256: "c".repeat(64) }] } };
function fixture() {
  const repository = { id: "repo", organizationId: "org", provider: "github", remoteOwner: "owner", remoteName: "repo", updatedAt: date };
  const policy = { id: "policy", enabled: true, blockAction: false, requiredApprovals: 2, requiredRoles: ["admin"], updatedAt: date };
  const tx = {
    orgMembership: { findUnique: vi.fn(async () => ({ id: "member", ...scope, role: "admin", acceptedAt: date, updatedAt: date })) },
    repository: { findFirst: vi.fn(async () => repository) },
    environment: { findFirst: vi.fn(async () => ({ id: "env", organizationId: "org", approvalPolicyId: "policy", updatedAt: date })) },
    gitHubInstallation: { findFirst: vi.fn(async () => ({ id: "install", organizationId: "org", githubInstallationId: "19", accountLogin: "owner", status: "active", installedAt: date, updatedAt: date, revokedAt: null, suspendedAt: null })) },
    branchEnvironmentPolicy: { findMany: vi.fn(async () => [] as unknown[]) },
    $queryRawUnsafe: vi.fn(async () => [policy]), $executeRawUnsafe: vi.fn(),
  };
  // Single test boundary: the real snapshot callback receives the composed read-only mock transaction.
  const transaction = vi.fn(async (operation: (value: typeof tx) => Promise<unknown>) => operation(tx));
  const client = { $transaction: transaction } as unknown as GithubBuildSnapshotClient;
  return { tx, repository, policy, transaction, client };
}
it("reuses actual selected-policy SQL/digest and tenant-scopes all reads in one bounded Serializable transaction", async () => {
  const f = fixture(), result = await readGithubBuildSnapshot(f.client, scope, request);
  expect(result?.policy.digest).toBe(evidenceDigest({ id: "policy", updatedAt: date.toISOString(), requiredApprovals: 2, allowedRoles: ["admin"], allowSelfApproval: false, blocked: false }));
  expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable", maxWait: 3000, timeout: 5000 });
  expect(f.tx.repository.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "repo", organizationId: "org", provider: "github" } }));
  expect(f.tx.environment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "env", organizationId: "org" } }));
  expect(f.tx.gitHubInstallation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org", status: "active" } }));
  expect(f.tx.branchEnvironmentPolicy.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org", repositoryId: "repo", environmentId: "env", enabled: true }, take: 101 }));
  expect(f.tx.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('JOIN "AxiomApprovalPolicy"'), "org", "env");
  expect(f.tx.$executeRawUnsafe).not.toHaveBeenCalled();
});
it("denies pending/non-management membership before reading tenant configuration or policy", async () => {
  const f = fixture(); f.tx.orgMembership.findUnique.mockResolvedValue({ id: "member", ...scope, role: "read_only", acceptedAt: date, updatedAt: date });
  expect(await readGithubBuildSnapshot(f.client, scope, request)).toBeNull();
  expect(f.tx.repository.findFirst).not.toHaveBeenCalled(); expect(f.tx.$queryRawUnsafe).not.toHaveBeenCalled();
});
it("retains database Date revisions in the canonical context fingerprint", async () => {
  const f = fixture(), first = await readGithubBuildSnapshot(f.client, scope, request);
  f.repository.updatedAt = new Date(date.getTime() + 1000);
  const second = await readGithubBuildSnapshot(f.client, scope, request);
  expect(first?.repository.updatedAt).toBe(date.toISOString());
  expect(evidenceDigest(second)).not.toBe(evidenceDigest(first));
});
it("fails closed on disabled selected policy and over-limit branch configuration", async () => {
  const f = fixture(); f.policy.enabled = false;
  expect(await readGithubBuildSnapshot(f.client, scope, request)).toBeNull();
  const overflow = fixture(); overflow.tx.branchEnvironmentPolicy.findMany.mockResolvedValue(Array.from({ length: 101 }, () => ({})));
  expect(await readGithubBuildSnapshot(overflow.client, scope, request)).toBeNull();
});
