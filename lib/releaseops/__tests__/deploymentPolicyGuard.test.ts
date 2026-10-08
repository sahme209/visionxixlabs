import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveGitReference: vi.fn(),
  getPullRequestGovernanceEvidence: vi.fn(),
}));

vi.mock("@/lib/connectors/github/githubWriteClient", () => ({
  resolveGitReference: mocks.resolveGitReference,
  getPullRequestGovernanceEvidence: mocks.getPullRequestGovernanceEvidence,
}));

import { evaluateDeploymentPolicy, type DeploymentPolicyRepo } from "../deploymentPolicyGuard";

const registered = { id: "repo_1", organizationId: "org-1", provider: "github", remoteOwner: "acme", remoteName: "widgets" };
const basePolicy = {
  id: "policy_1",
  branchPattern: "release/*",
  requireReleaseTag: false,
  requireCodeowners: false,
  requirePrLink: false,
  requireChangeTicket: false,
  requirePromotionFromEnvironmentId: null,
  priority: 100,
};

function makeRepo(
  policies = [basePolicy],
  repositories = [registered],
  priorExecutions: Array<{ id: string; environmentId: string; sourceCommitSha: string | null; status: string; conclusion: string | null }> = [],
): DeploymentPolicyRepo {
  return {
    repository: { findMany: vi.fn(async () => repositories) },
    branchEnvironmentPolicy: { findMany: vi.fn(async () => policies) },
    deploymentExecution: {
      findFirst: vi.fn(async ({ where }) => priorExecutions.find((row) => row.id === where.id) ?? null),
    },
  };
}

const input = {
  organizationId: "org-1",
  environmentId: "env-1",
  owner: "acme",
  repo: "widgets",
  sourceRef: "release/2026-10",
  sourceKind: "branch" as const,
  installationToken: "scoped-token",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveGitReference.mockResolvedValue({ ok: true, data: { kind: "branch", ref: input.sourceRef, commitSha: "sha-1" } });
  mocks.getPullRequestGovernanceEvidence.mockResolvedValue({
    ok: true,
    data: {
      number: 42,
      state: "closed",
      mergedAt: "2026-10-07T12:00:00Z",
      headRef: input.sourceRef,
      baseRef: "main",
      headSha: "sha-1",
      mergeCommitSha: "merge-sha",
      approvedReviewCount: 1,
      codeOwnerReviewsRequired: true,
      linkedChangeTickets: ["CHG12345"],
      htmlUrl: "https://github.test/acme/widgets/pull/42",
    },
  });
});

describe("evaluateDeploymentPolicy", () => {
  it("verifies the live ref but applies no policy when the repository has no policy record", async () => {
    const result = await evaluateDeploymentPolicy(makeRepo([], []), input);
    expect(result).toEqual({ ok: true, policyId: null, sourceCommitSha: "sha-1", pullRequestUrl: null });
    expect(mocks.resolveGitReference).toHaveBeenCalledOnce();
  });

  it("denies when configured policies do not match the requested ref", async () => {
    const result = await evaluateDeploymentPolicy(makeRepo(), { ...input, sourceRef: "main" });
    expect(result).toEqual({ ok: false, error: "branch_policy_no_matching_ref" });
    expect(mocks.resolveGitReference).not.toHaveBeenCalled();
  });

  it("requires a tag when the matching policy says so", async () => {
    const result = await evaluateDeploymentPolicy(makeRepo([{ ...basePolicy, requireReleaseTag: true }]), input);
    expect(result).toEqual({ ok: false, error: "branch_policy_release_tag_required", policyId: "policy_1" });
  });

  it("allows a live matching ref when no extra evidence is required", async () => {
    const result = await evaluateDeploymentPolicy(makeRepo(), input);
    expect(result).toEqual({ ok: true, policyId: "policy_1", sourceCommitSha: "sha-1", pullRequestUrl: null });
    expect(mocks.resolveGitReference).toHaveBeenCalledWith(expect.objectContaining({ installationToken: "scoped-token" }));
  });

  it("fails closed when a required pull request is missing", async () => {
    const result = await evaluateDeploymentPolicy(makeRepo([{ ...basePolicy, requirePrLink: true }]), input);
    expect(result).toEqual({ ok: false, error: "branch_policy_pull_request_required", policyId: "policy_1" });
  });

  it("rejects PR evidence that does not identify the deployed commit", async () => {
    mocks.getPullRequestGovernanceEvidence.mockResolvedValue({
      ok: true,
      data: { mergedAt: "2026-10-07T12:00:00Z", headSha: "other", mergeCommitSha: "different" },
    });
    const result = await evaluateDeploymentPolicy(
      makeRepo([{ ...basePolicy, requirePrLink: true }]),
      { ...input, pullRequestNumber: 42 },
    );
    expect(result).toEqual({ ok: false, error: "branch_policy_pull_request_ref_mismatch", policyId: "policy_1" });
  });

  it("enforces live CODEOWNERS and change-ticket evidence", async () => {
    const result = await evaluateDeploymentPolicy(
      makeRepo([{ ...basePolicy, requirePrLink: true, requireCodeowners: true, requireChangeTicket: true }]),
      { ...input, pullRequestNumber: 42 },
    );
    expect(result).toEqual({
      ok: true,
      policyId: "policy_1",
      sourceCommitSha: "sha-1",
      pullRequestUrl: "https://github.test/acme/widgets/pull/42",
    });
    expect(mocks.getPullRequestGovernanceEvidence).toHaveBeenCalledWith(expect.objectContaining({ requireCodeowners: true }));
  });

  describe("promotion chain", () => {
    const promotionPolicy = { ...basePolicy, requirePromotionFromEnvironmentId: "env-dev" };

    it("denies when a promotion-required policy gets no promotedFromExecutionId", async () => {
      const result = await evaluateDeploymentPolicy(makeRepo([promotionPolicy]), input);
      expect(result).toEqual({ ok: false, error: "branch_policy_promotion_required", policyId: "policy_1" });
    });

    it("denies when the referenced prior execution does not exist", async () => {
      const result = await evaluateDeploymentPolicy(makeRepo([promotionPolicy]), { ...input, promotedFromExecutionId: "missing" });
      expect(result).toEqual({ ok: false, error: "branch_policy_promotion_execution_not_found", policyId: "policy_1" });
    });

    it("denies when the prior execution targeted a different environment", async () => {
      const repo = makeRepo([promotionPolicy], [registered], [
        { id: "exec_1", environmentId: "env-other", sourceCommitSha: "sha-1", status: "completed", conclusion: "success" },
      ]);
      const result = await evaluateDeploymentPolicy(repo, { ...input, promotedFromExecutionId: "exec_1" });
      expect(result).toEqual({ ok: false, error: "branch_policy_promotion_wrong_environment", policyId: "policy_1" });
    });

    it("denies when the prior execution did not succeed", async () => {
      const repo = makeRepo([promotionPolicy], [registered], [
        { id: "exec_1", environmentId: "env-dev", sourceCommitSha: "sha-1", status: "completed", conclusion: "failure" },
      ]);
      const result = await evaluateDeploymentPolicy(repo, { ...input, promotedFromExecutionId: "exec_1" });
      expect(result).toEqual({ ok: false, error: "branch_policy_promotion_not_successful", policyId: "policy_1" });
    });

    it("denies when the prior execution's commit does not match the deploy's resolved commit", async () => {
      const repo = makeRepo([promotionPolicy], [registered], [
        { id: "exec_1", environmentId: "env-dev", sourceCommitSha: "different-sha", status: "completed", conclusion: "success" },
      ]);
      const result = await evaluateDeploymentPolicy(repo, { ...input, promotedFromExecutionId: "exec_1" });
      expect(result).toEqual({ ok: false, error: "branch_policy_promotion_commit_mismatch", policyId: "policy_1" });
    });

    it("allows promotion when the prior execution succeeded against the right environment with the same commit", async () => {
      const repo = makeRepo([promotionPolicy], [registered], [
        { id: "exec_1", environmentId: "env-dev", sourceCommitSha: "sha-1", status: "completed", conclusion: "success" },
      ]);
      const result = await evaluateDeploymentPolicy(repo, { ...input, promotedFromExecutionId: "exec_1" });
      expect(result).toEqual({ ok: true, policyId: "policy_1", sourceCommitSha: "sha-1", pullRequestUrl: null });
    });
  });
});
