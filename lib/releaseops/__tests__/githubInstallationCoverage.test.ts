/**
 * Locks in the "validated against the installed GitHub selection" gate
 * for release evidence binding: a repository is only considered covered
 * when (a) the org has an active GitHub App installation, and (b) GitHub
 * actually mints a token scoped to that repository name — the same
 * signal app/api/desktop/deployments/[id]/github-evidence already
 * relies on for an equivalent purpose.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findInstallation: vi.fn(),
  resolveGithubInstallationToken: vi.fn(),
}));

vi.mock("@/lib/connectors/github/githubAppAuth", () => ({
  resolveGithubInstallationToken: mocks.resolveGithubInstallationToken,
}));

const repo = { gitHubInstallation: { findFirst: mocks.findInstallation } };

describe("verifyRepositoryCoveredByInstallation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when the org has no active GitHub installation", async () => {
    mocks.findInstallation.mockResolvedValue(null);
    const { verifyRepositoryCoveredByInstallation } = await import("../githubInstallationCoverage");
    const result = await verifyRepositoryCoveredByInstallation(repo, "org-1", "checkout-api");

    expect(result).toEqual({ ok: false, reason: "github_not_connected" });
    expect(mocks.resolveGithubInstallationToken).not.toHaveBeenCalled();
  });

  it("fails closed when a DB lookup error occurs, rather than throwing", async () => {
    mocks.findInstallation.mockRejectedValue(new Error("db down"));
    const { verifyRepositoryCoveredByInstallation } = await import("../githubInstallationCoverage");
    const result = await verifyRepositoryCoveredByInstallation(repo, "org-1", "checkout-api");

    expect(result).toEqual({ ok: false, reason: "github_not_connected" });
  });

  it("reports repository_not_in_installation when GitHub refuses to mint a scoped token for it", async () => {
    mocks.findInstallation.mockResolvedValue({ githubInstallationId: "12345" });
    mocks.resolveGithubInstallationToken.mockResolvedValue({ ok: false, errorCode: "github.app_invalid_repository_scope" });

    const { verifyRepositoryCoveredByInstallation } = await import("../githubInstallationCoverage");
    const result = await verifyRepositoryCoveredByInstallation(repo, "org-1", "not-my-repo");

    expect(result).toEqual({ ok: false, reason: "repository_not_in_installation" });
    expect(mocks.resolveGithubInstallationToken).toHaveBeenCalledWith({
      installationId: 12345,
      repositories: ["not-my-repo"],
    });
  });

  it("reports ok when GitHub mints a token scoped to the repository", async () => {
    mocks.findInstallation.mockResolvedValue({ githubInstallationId: "12345" });
    mocks.resolveGithubInstallationToken.mockResolvedValue({ ok: true, token: "ghs_fake", installationId: 12345, expiresAt: Date.now() + 3600_000 });

    const { verifyRepositoryCoveredByInstallation } = await import("../githubInstallationCoverage");
    const result = await verifyRepositoryCoveredByInstallation(repo, "org-1", "checkout-api");

    expect(result).toEqual({ ok: true });
  });

  it("only requests the scope for the single repository being validated, never the whole installation", async () => {
    mocks.findInstallation.mockResolvedValue({ githubInstallationId: "99" });
    mocks.resolveGithubInstallationToken.mockResolvedValue({ ok: true, token: "t", installationId: 99, expiresAt: 0 });

    const { verifyRepositoryCoveredByInstallation } = await import("../githubInstallationCoverage");
    await verifyRepositoryCoveredByInstallation(repo, "org-1", "checkout-api");

    const call = mocks.resolveGithubInstallationToken.mock.calls[0][0];
    expect(call.repositories).toEqual(["checkout-api"]);
    expect(call.repositories).toHaveLength(1);
  });
});
