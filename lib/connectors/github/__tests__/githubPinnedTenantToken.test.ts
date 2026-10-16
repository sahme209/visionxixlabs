import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ installation: vi.fn(), mint: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { gitHubInstallation: { findFirst: mocks.installation } } }));
vi.mock("../githubAppAuth", () => ({ resolveGithubInstallationToken: mocks.mint }));
import { resolveTenantScopedToken } from "../resolveTenantScopedToken";
const revision = new Date("2026-10-16T00:00:00Z");
const row = { id: "tenant-install", githubInstallationId: "19", updatedAt: revision, revokedAt: null, suspendedAt: null };
beforeEach(() => { vi.clearAllMocks(); mocks.installation.mockResolvedValue(row); mocks.mint.mockResolvedValue({ ok: true, token: "fixture-scoped-token", installationId: 19 }); });

it("pins tenant installation identity/revision and scopes issuance to exactly one repository", async () => {
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row)).toEqual({ ok: true, token: "fixture-scoped-token" });
  expect(mocks.installation).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org", status: "active" }, select: expect.objectContaining({ id: true, updatedAt: true }) }));
  expect(mocks.mint).toHaveBeenCalledWith({ installationId: 19, repositories: ["repo"] });
});
it.each([
  { ...row, id: "different-install" }, { ...row, githubInstallationId: "20" }, { ...row, updatedAt: new Date("2026-10-16T00:00:01Z") },
  { ...row, revokedAt: revision }, { ...row, suspendedAt: revision },
])("refuses installation replacement/revision/revocation before token issuance", async changed => {
  mocks.installation.mockResolvedValue(changed);
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row)).toEqual({ ok: false, error: "github_not_connected" });
  expect(mocks.mint).not.toHaveBeenCalled();
});
it("refuses an auth resolver result for a different installation", async () => {
  mocks.mint.mockResolvedValue({ ok: true, token: "wrong-installation", installationId: 20 });
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row)).toEqual({ ok: false, error: "github_token_unavailable" });
});
it("preserves legacy two-argument lookup and response", async () => {
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" })).toEqual({ ok: true, token: "fixture-scoped-token" });
  expect(mocks.installation).toHaveBeenCalledWith({ where: { organizationId: "org", status: "active" }, orderBy: { installedAt: "desc" }, select: { githubInstallationId: true } });
});
it("uses the supplied installation repository rather than ambient database authority", async () => {
  const scopedLookup = vi.fn().mockResolvedValue(row);
  expect(await resolveTenantScopedToken("org", { owner: "owner", repo: "repo" }, row,
    { gitHubInstallation: { findFirst: scopedLookup } })).toEqual({ ok: true, token: "fixture-scoped-token" });
  expect(scopedLookup).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org", status: "active" } }));
  expect(mocks.installation).not.toHaveBeenCalled();
});
