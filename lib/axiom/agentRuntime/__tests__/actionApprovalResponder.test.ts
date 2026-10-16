import { deploymentEvidence } from "@/lib/releaseops/deploymentEvidence";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTenantScopedToken: vi.fn(),
  createBranch: vi.fn(),
  commitFile: vi.fn(),
  commitFiles: vi.fn(),
  createPullRequest: vi.fn(),
  dispatchWorkflow: vi.fn(),
  resolveGitReference: vi.fn(),
  getFile: vi.fn(),
  getRepositoryDefaultBranch: vi.fn(),
  reserveDeploymentDispatch: vi.fn(),
  releaseDeploymentDispatch: vi.fn(),
  settleDeploymentDispatch: vi.fn(),
}));

vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  resolveTenantScopedToken: mocks.resolveTenantScopedToken,
  parseRepositoryFullName: (value: string) => {
    const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
    return match ? { owner: match[1], repo: match[2] } : null;
  },
}));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({
  createBranch: mocks.createBranch, commitFile: mocks.commitFile, commitFiles: mocks.commitFiles, createPullRequest: mocks.createPullRequest, dispatchWorkflow: mocks.dispatchWorkflow, getFile: mocks.getFile,
  getRepositoryDefaultBranch: mocks.getRepositoryDefaultBranch,
  resolveGitReference: mocks.resolveGitReference,
}));
vi.mock("@/lib/billing/deploymentDispatchReservation", () => ({
  reserveDeploymentDispatch: mocks.reserveDeploymentDispatch,
  releaseDeploymentDispatch: mocks.releaseDeploymentDispatch,
  settleDeploymentDispatch: mocks.settleDeploymentDispatch,
}));

import { executeApprovedAction, type ActionExecutionRepo } from "../actionApprovalResponder";

const repo: ActionExecutionRepo = {
  environment: { findUnique: vi.fn(async () => ({ id: "env_1", organizationId: "org-1", tier: "dev" })) },
  deploymentTarget: { findUnique: vi.fn(async () => ({ organizationId: "org-1", roleArn: "arn:aws:iam::123:role/x", region: "us-east-2", ecsCluster: "c", ecsService: "s" })) },
  repository: { findMany: vi.fn(async () => []) },
  branchEnvironmentPolicy: { findMany: vi.fn(async () => []) },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
  mocks.resolveGitReference.mockResolvedValue({ ok: true, data: { kind: "branch", ref: "main", commitSha: "sha-main" } });
  mocks.getRepositoryDefaultBranch.mockResolvedValue({ ok: true, data: "main" });
  mocks.reserveDeploymentDispatch.mockResolvedValue({ ok: true, reused: false, reservation: { id: "exec-1" }, planId: "free", used: 0, limit: 10 });
  mocks.releaseDeploymentDispatch.mockResolvedValue(true);
  mocks.settleDeploymentDispatch.mockResolvedValue(false);
});

describe("executeApprovedAction", () => {
  it.each(["workflow_dispatch_failed: fetch failed", "workflow_dispatch_failed: github_503: unavailable"])("preserves the Agent deployment reservation for an uncertain dispatch: %s", async (error) => {
    mocks.dispatchWorkflow.mockResolvedValue({ ok: false, error });
    expect(await executeApprovedAction(repo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" }, "user-1", "action-uncertain"))
      .toEqual({ ok: false, error: "deployment_outcome_unknown" });
    expect(mocks.releaseDeploymentDispatch).not.toHaveBeenCalled();
  });

  it("releases the Agent deployment reservation after a definite provider rejection", async () => {
    mocks.dispatchWorkflow.mockResolvedValue({ ok: false, error: "workflow_dispatch_failed: github_422: invalid ref" });
    expect(await executeApprovedAction(repo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" }, "user-1", "action-rejected"))
      .toEqual({ ok: false, error: "workflow_dispatch_failed: github_422: invalid ref" });
    expect(mocks.releaseDeploymentDispatch).toHaveBeenCalledWith(expect.anything(), "org-1", "exec-1");
  });


  it("rejects an older sensitive-file proposal even when it has valid review metadata", async () => {
    const result = await executeApprovedAction(repo, "org-1", "commit_github_file", {
      repositoryFullName: "acme/widgets", branch: "fix", path: ".env.production", content: "fixture", message: "Fixture",
      _review: { kind: "github_file", baseSha: "fixture-sha", baseContent: "fixture", htmlUrl: null },
    });
    expect(result).toEqual({ ok: false, error: "sensitive_repository_file" });
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
    expect(mocks.commitFile).not.toHaveBeenCalled();
  });

  it("rejects an older multi-file sensitive proposal before resolving credentials", async () => {
    const result = await executeApprovedAction(repo, "org-1", "commit_github_files", {
      repositoryFullName: "acme/widgets", branch: "fix", message: "Fixture",
      files: [{ path: "src/app.ts", content: "fixture" }, { path: "secrets/prod.json", content: "fixture" }],
      _review: { kind: "github_files", files: [{ path: "src/app.ts", baseSha: "app", baseContent: "fixture" }, { path: "secrets/prod.json", baseSha: "config", baseContent: "fixture" }] },
    });
    expect(result).toEqual({ ok: false, error: "sensitive_repository_file" });
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
    expect(mocks.commitFiles).not.toHaveBeenCalled();
  });
  it("rejects an unknown tool name", async () => {
    const result = await executeApprovedAction(repo, "org-1", "delete_everything", {});
    expect(result.ok).toBe(false);
  });

  it("create_github_branch calls the real write function with a scoped token", async () => {
    mocks.createBranch.mockResolvedValue({ ok: true, data: { ref: "refs/heads/x", sha: "abc" } });
    const result = await executeApprovedAction(repo, "org-1", "create_github_branch", { repositoryFullName: "acme/widgets", baseBranch: "main", newBranchName: "fix" });
    expect(result).toEqual({ ok: true, result: { ref: "refs/heads/x", sha: "abc" } });
    expect(mocks.createBranch).toHaveBeenCalledWith(expect.objectContaining({ owner: "acme", repo: "widgets", installationToken: "installation-token" }));
  });

  it("commit_github_file rejects an incomplete payload before calling GitHub", async () => {
    const result = await executeApprovedAction(repo, "org-1", "commit_github_file", { repositoryFullName: "acme/widgets" });
    expect(result).toEqual({ ok: false, error: "invalid_payload" });
    expect(mocks.commitFile).not.toHaveBeenCalled();
  });

  it("passes the server-reviewed base SHA into the GitHub commit", async () => {
    mocks.commitFile.mockResolvedValue({ ok: true, data: { sha: "new", htmlUrl: "https://github.test/file" } });
    await executeApprovedAction(repo, "org-1", "commit_github_file", {
      repositoryFullName: "acme/widgets", branch: "fix", path: "src/app.ts", content: "new", message: "Update app",
      _review: { kind: "github_file", baseSha: "reviewed-sha", baseContent: "old", htmlUrl: "https://github.test/old" },
    });
    expect(mocks.commitFile).toHaveBeenCalledWith(expect.objectContaining({ expectedSha: "reviewed-sha" }));
  });

  it.each([undefined, { kind: "github_file", baseContent: "old" }, { kind: "github_file", baseSha: 42, baseContent: "old" }])("rejects missing or malformed single-file review evidence %j before contacting GitHub", async (_review) => {
    const result = await executeApprovedAction(repo, "org-1", "commit_github_file", {
      repositoryFullName: "acme/widgets", branch: "fix", path: "src/app.ts", content: "new", message: "Update app", _review,
    });
    expect(result).toEqual({ ok: false, error: "file_review_required" });
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
    expect(mocks.commitFile).not.toHaveBeenCalled();
  });

  it("preserves reviewed new-file creation with an explicit absent base SHA", async () => {
    mocks.commitFile.mockResolvedValue({ ok: true, data: { sha: "new", htmlUrl: "https://github.test/file" } });
    const result = await executeApprovedAction(repo, "org-1", "commit_github_file", {
      repositoryFullName: "acme/widgets", branch: "fix", path: "src/new.ts", content: "new", message: "Add file",
      _review: { kind: "github_file", baseSha: null, baseContent: "", htmlUrl: null },
    });
    expect(result.ok).toBe(true);
    expect(mocks.commitFile).toHaveBeenCalledWith(expect.objectContaining({ expectedSha: null }));
  });

  it("commits multiple reviewed files atomically on a non-default branch", async () => {
    mocks.commitFiles.mockResolvedValue({ ok: true, data: { sha: "commit", htmlUrl: "https://github.test/commit", fileCount: 2 } });
    const result = await executeApprovedAction(repo, "org-1", "commit_github_files", {
      repositoryFullName: "acme/widgets", branch: "axiom/change", message: "Update feature",
      files: [{ path: "src/a.ts", content: "new a" }, { path: "src/b.ts", content: "new b" }],
      _review: { kind: "github_files", files: [
        { path: "src/a.ts", baseSha: "a-sha", baseContent: "old a", htmlUrl: null },
        { path: "src/b.ts", baseSha: null, baseContent: "", htmlUrl: null },
      ] },
    });
    expect(result.ok).toBe(true);
    expect(mocks.commitFiles).toHaveBeenCalledWith(expect.objectContaining({
      files: [{ path: "src/a.ts", content: "new a", expectedSha: "a-sha" }, { path: "src/b.ts", content: "new b", expectedSha: null }],
    }));
  });

  it("open_github_pull_request surfaces a GitHub failure as an error, not a thrown exception", async () => {
    mocks.createPullRequest.mockResolvedValue({ ok: false, error: "pull_request_create_failed: github_422" });
    const result = await executeApprovedAction(repo, "org-1", "open_github_pull_request", { repositoryFullName: "acme/widgets", head: "fix", base: "main", title: "Fix" });
    expect(result).toEqual({ ok: false, error: "pull_request_create_failed: github_422" });
  });

  it("trigger_aws_deploy 404s when the environment doesn't belong to this org", async () => {
    const otherOrgRepo: ActionExecutionRepo = {
      environment: { findUnique: vi.fn(async () => ({ id: "env_1", organizationId: "other_org", tier: "dev" })) },
      deploymentTarget: { findUnique: vi.fn() },
      repository: { findMany: vi.fn(async () => []) },
      branchEnvironmentPolicy: { findMany: vi.fn(async () => []) },
    };
    const result = await executeApprovedAction(otherOrgRepo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" }, "user-1", "test-action");
    expect(result).toEqual({ ok: false, error: "environment_not_found" });
  });

  it("trigger_aws_deploy fails closed when no deploy target is configured", async () => {
    const noTargetRepo: ActionExecutionRepo = {
      environment: { findUnique: vi.fn(async () => ({ id: "env_1", organizationId: "org-1", tier: "dev" })) },
      deploymentTarget: { findUnique: vi.fn(async () => null) },
      repository: { findMany: vi.fn(async () => []) },
      branchEnvironmentPolicy: { findMany: vi.fn(async () => []) },
    };
    const result = await executeApprovedAction(noTargetRepo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" }, "user-1", "test-action");
    expect(result).toEqual({ ok: false, error: "deployment_target_not_configured" });
  });

  it("trigger_aws_deploy denies a promotion-required policy with no promotedFromExecutionId, even without deploymentExecution storage wired in", async () => {
    const promotionRepo: ActionExecutionRepo = {
      environment: { findUnique: vi.fn(async () => ({ id: "env_1", organizationId: "org-1", tier: "dev" })) },
      deploymentTarget: { findUnique: vi.fn(async () => ({ organizationId: "org-1", roleArn: "arn:aws:iam::123:role/x", region: "us-east-2", ecsCluster: "c", ecsService: "s" })) },
      repository: { findMany: vi.fn(async () => [{ id: "repo_1", organizationId: "org-1", provider: "github", remoteOwner: "acme", remoteName: "widgets" }]) },
      branchEnvironmentPolicy: {
        findMany: vi.fn(async () => [{
          id: "policy_1", branchPattern: "main", requireReleaseTag: false, requireCodeowners: false,
          requirePrLink: false, requireChangeTicket: false, requirePromotionFromEnvironmentId: "env_dev",
          requireTestsPassing: false, priority: 100,
        }]),
      },
    };
    const result = await executeApprovedAction(promotionRepo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" }, "user-1", "test-action");
    expect(result).toEqual({ ok: false, error: "branch_policy_promotion_artifact_unverified" });
    expect(mocks.dispatchWorkflow).not.toHaveBeenCalled();
  });

  it("trigger_aws_deploy dispatches the workflow with the target's own config", async () => {
    mocks.dispatchWorkflow.mockResolvedValue({ ok: true, data: { workflowRunId: "123", runUrl: "https://api.github.test/runs/123", htmlUrl: "https://github.test/runs/123" } });
    const result = await executeApprovedAction(repo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" }, "user-1", "test-action");
    expect(result).toEqual({ ok: true, result: { dispatched: true, evidence: deploymentEvidence("service_restart"), execution: null, trackingAvailable: false, policyId: null, sourceRef: "main", sourceKind: "branch" } });
    expect(mocks.dispatchWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      inputs: { role_arn: "arn:aws:iam::123:role/x", region: "us-east-2", cluster: "c", service: "s" },
    }));
  });

  it("trigger_aws_deploy stops after policy evaluation when quota is exhausted", async () => {
    mocks.reserveDeploymentDispatch.mockResolvedValue({ ok: false, error: "deployment_quota_exhausted", used: 10, limit: 10 });
    const result = await executeApprovedAction(repo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" }, "user-1", "test-action");
    expect(result).toEqual({ ok: false, error: "deployment_quota_exhausted" });
    expect(mocks.dispatchWorkflow).not.toHaveBeenCalled();
  });
});
