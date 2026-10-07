import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTenantScopedToken: vi.fn(),
  createBranch: vi.fn(),
  commitFile: vi.fn(),
  createPullRequest: vi.fn(),
  dispatchWorkflow: vi.fn(),
  getFile: vi.fn(),
}));

vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  resolveTenantScopedToken: mocks.resolveTenantScopedToken,
  parseRepositoryFullName: (value: string) => {
    const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
    return match ? { owner: match[1], repo: match[2] } : null;
  },
}));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({
  createBranch: mocks.createBranch, commitFile: mocks.commitFile, createPullRequest: mocks.createPullRequest, dispatchWorkflow: mocks.dispatchWorkflow, getFile: mocks.getFile,
}));

import { executeApprovedAction, type ActionExecutionRepo } from "../actionApprovalResponder";

const repo: ActionExecutionRepo = {
  environment: { findUnique: vi.fn(async () => ({ id: "env_1", organizationId: "org-1" })) },
  deploymentTarget: { findUnique: vi.fn(async () => ({ organizationId: "org-1", roleArn: "arn:aws:iam::123:role/x", region: "us-east-2", ecsCluster: "c", ecsService: "s" })) },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
});

describe("executeApprovedAction", () => {
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

  it("open_github_pull_request surfaces a GitHub failure as an error, not a thrown exception", async () => {
    mocks.createPullRequest.mockResolvedValue({ ok: false, error: "pull_request_create_failed: github_422" });
    const result = await executeApprovedAction(repo, "org-1", "open_github_pull_request", { repositoryFullName: "acme/widgets", head: "fix", base: "main", title: "Fix" });
    expect(result).toEqual({ ok: false, error: "pull_request_create_failed: github_422" });
  });

  it("trigger_aws_deploy 404s when the environment doesn't belong to this org", async () => {
    const otherOrgRepo: ActionExecutionRepo = {
      environment: { findUnique: vi.fn(async () => ({ id: "env_1", organizationId: "other_org" })) },
      deploymentTarget: { findUnique: vi.fn() },
    };
    const result = await executeApprovedAction(otherOrgRepo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" });
    expect(result).toEqual({ ok: false, error: "environment_not_found" });
  });

  it("trigger_aws_deploy fails closed when no deploy target is configured", async () => {
    const noTargetRepo: ActionExecutionRepo = {
      environment: { findUnique: vi.fn(async () => ({ id: "env_1", organizationId: "org-1" })) },
      deploymentTarget: { findUnique: vi.fn(async () => null) },
    };
    const result = await executeApprovedAction(noTargetRepo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" });
    expect(result).toEqual({ ok: false, error: "deployment_target_not_configured" });
  });

  it("trigger_aws_deploy dispatches the workflow with the target's own config", async () => {
    mocks.dispatchWorkflow.mockResolvedValue({ ok: true, data: {} });
    const result = await executeApprovedAction(repo, "org-1", "trigger_aws_deploy", { repositoryFullName: "acme/widgets", environmentId: "env_1" });
    expect(result).toEqual({ ok: true, result: { dispatched: true } });
    expect(mocks.dispatchWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      inputs: { role_arn: "arn:aws:iam::123:role/x", region: "us-east-2", cluster: "c", service: "s" },
    }));
  });
});
