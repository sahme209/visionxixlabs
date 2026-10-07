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

import { prepareProposalArgsForReview } from "../proposalReview";

describe("prepareProposalArgsForReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "scoped-token" });
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
});
