import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTenantScopedToken: vi.fn(),
  getFile: vi.fn(),
}));

vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  resolveTenantScopedToken: mocks.resolveTenantScopedToken,
  parseRepositoryFullName: (value: string) => {
    const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
    return match ? { owner: match[1], repo: match[2] } : null;
  },
}));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ getFile: mocks.getFile }));

import { agentActionDigest } from "../proposalIntegrity";
import { prepareProposalArgsForReview } from "../proposalReview";

describe("prepareProposalArgsForReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "scoped-token" });
  });

  it.each(["commit_github_file", "commit_github_files"])("does not capture sensitive contents for %s", async (tool) => {
    const result = await prepareProposalArgsForReview("org-1", tool, {
      repositoryFullName: "acme/widgets", branch: "fix", path: ".env.production", content: "fixture",
      files: [{ path: "src/app.ts", content: "fixture" }, { path: "secrets/prod.json", content: "fixture" }],
    });
    expect(result).toEqual({ ok: false, error: "sensitive_repository_file" });
    expect(mocks.resolveTenantScopedToken).not.toHaveBeenCalled();
    expect(mocks.getFile).not.toHaveBeenCalled();
  });

  it("replaces model-supplied review data with a tenant-scoped GitHub snapshot", async () => {
    mocks.getFile.mockResolvedValue({ ok: true, data: { path: "src/app.ts", sha: "base-sha", content: "old\n", htmlUrl: "https://github.test/file" } });
    const result = await prepareProposalArgsForReview("org-1", "commit_github_file", {
      repositoryFullName: "acme/widgets", branch: "fix", path: "src/app.ts", content: "new\n",
      _review: { baseSha: "model-controlled", baseContent: "fake" },
    });
    expect(result).toEqual({
      ok: true,
      args: expect.objectContaining({
        _review: { kind: "github_file", baseSha: "base-sha", baseContent: "old\n", htmlUrl: "https://github.test/file" },
      }),
    });
    expect(mocks.getFile).toHaveBeenCalledWith(expect.objectContaining({ installationToken: "scoped-token" }));
  });

  it("captures an absent file as a create-file snapshot", async () => {
    mocks.getFile.mockResolvedValue({ ok: false, error: "github_404: not found" });
    const result = await prepareProposalArgsForReview("org-1", "commit_github_file", {
      repositoryFullName: "acme/widgets", branch: "fix", path: "new.txt", content: "new",
    });
    expect(result).toEqual({ ok: true, args: expect.objectContaining({ _review: expect.objectContaining({ baseSha: null, baseContent: "" }) }) });
  });

  it("fails closed when the current file cannot be reviewed", async () => {
    mocks.getFile.mockResolvedValue({ ok: false, error: "github_500: unavailable" });
    await expect(prepareProposalArgsForReview("org-1", "commit_github_file", {
      repositoryFullName: "acme/widgets", branch: "fix", path: "src/app.ts", content: "new",
    })).resolves.toEqual({ ok: false, error: "file_review_unavailable: github_500: unavailable" });
  });

  it("captures trusted snapshots for every file in a multi-file proposal", async () => {
    mocks.getFile
      .mockResolvedValueOnce({ ok: true, data: { path: "src/a.ts", sha: "a", content: "old a", htmlUrl: "https://github.test/a" } })
      .mockResolvedValueOnce({ ok: false, error: "github_404: not found" });
    const result = await prepareProposalArgsForReview("org-1", "commit_github_files", {
      repositoryFullName: "acme/widgets", branch: "axiom/change", message: "Update",
      files: [{ path: "src/a.ts", content: "new a" }, { path: "src/b.ts", content: "new b" }],
    });
    expect(result).toEqual({ ok: true, args: expect.objectContaining({
      _review: { kind: "github_files", files: [
        expect.objectContaining({ path: "src/a.ts", baseSha: "a", baseContent: "old a" }),
        expect.objectContaining({ path: "src/b.ts", baseSha: null, baseContent: "" }),
      ] },
    }) });
  });
});

describe("ECS restart proposal server target evidence", () => {
  const row = { id: "target", organizationId: "org-1", provider: "aws", updatedAt: new Date("2026-10-16T00:00:00Z"), roleArn: "arn:aws:iam::123456789012:role/restart", region: "us-east-1", ecsCluster: "cluster", ecsService: "service" };
  const targetRepo = { environment: { findUnique: vi.fn(async () => ({ id: "env", organizationId: "org-1", tier: "dev" })) }, deploymentTarget: { findUnique: vi.fn(async () => row) } };
  it("discards forged caller review and captures exact current tenant target", async () => {
    const result = await prepareProposalArgsForReview("org-1", "trigger_aws_deploy", { environmentId: "env", _review: { kind: "ecs_restart_target", roleArn: "attacker" } }, targetRepo);
    expect(result).toEqual({ ok: true, args: { environmentId: "env", _review: { kind: "ecs_restart_target", organizationId: "org-1", environmentId: "env", environmentTier: "dev", targetId: "target", provider: "aws", targetUpdatedAt: row.updatedAt.toISOString(), roleArn: row.roleArn, region: row.region, ecsCluster: row.ecsCluster, ecsService: row.ecsService } } });
  });
  it("binds captured target data into the existing approval digest", async () => {
    const prepared = await prepareProposalArgsForReview("org-1", "trigger_aws_deploy", { environmentId: "env" }, targetRepo);
    if (!prepared.ok) throw new Error("expected server review");
    const digest = (args: Record<string, unknown>) => agentActionDigest({ organizationId: "org-1", conversationId: "conversation", proposedByUserId: "author", toolName: "trigger_aws_deploy", args });
    expect(digest(prepared.args)).not.toBe(digest({ ...prepared.args, _review: { ...(prepared.args._review as object), ecsService: "different" } }));
  });
  it("cannot trust caller evidence without a server repository", async () => {
    expect(await prepareProposalArgsForReview("org-1", "trigger_aws_deploy", { environmentId: "env", _review: row })).toEqual({ ok: false, error: "deployment_target_review_unavailable" });
  });
  it("does not capture another tenant target", async () => {
    expect(await prepareProposalArgsForReview("other-org", "trigger_aws_deploy", { environmentId: "env" }, targetRepo)).toEqual({ ok: false, error: "deployment_target_review_unavailable" });
  });
});
