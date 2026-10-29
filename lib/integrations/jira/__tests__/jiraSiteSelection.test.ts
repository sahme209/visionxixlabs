import { beforeEach, expect, it, vi } from "vitest";
import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "../../tenantAuthorization";
const m = vi.hoisted(() => ({ sites: vi.fn() }));
vi.mock("../jiraOAuth", async original => ({ ...await original<typeof import("../jiraOAuth")>(), readJiraAccessibleSites: m.sites }));
import { discoverJiraSites, prepareJiraSiteSelection, type JiraSiteSelectionRepository } from "../jiraSiteSelection";
const actor = { organizationId: "tenant", userId: "owner", canManageConnections: true };
const revision = "2026-10-24T12:00:00.000Z", now = Date.parse(revision);
const site = { id: "12345678-1234-4234-8234-123456789abc", name: "Fixture Jira", url: "https://fixture.atlassian.net", scopes: ["read:jira-work"] };
function fixture() {
 const controller = new AbortController();
 const clock = { value: now };
 const credential = { accessToken: "PRIVATE_ACCESS", refreshToken: "PRIVATE_REFRESH", expiresAt: now + 60_000 };
 const row = { id: "connection", organizationId: "tenant", provider: "jira", status: "pending", revokedAt: null, consentedByUserId: "owner", updatedAt: new Date(revision), scopesJson: ["read:jira-work", "offline_access"], encryptedCredential: encryptScopedCredential(JSON.stringify(credential), connectionCredentialContext({ organizationId: "tenant", provider: "jira", connectionId: "connection" })) };
 const findFirst = vi.fn(async (_args: { where: unknown }) => row);
 const repo = { tenantIntegrationConnection: { findFirst } } as JiraSiteSelectionRepository;
 const authority = vi.fn(async () => actor);
 const input = { actor, readCurrentActor: authority, connectionId: "connection", revision, signal: controller.signal, now: () => clock.value };
 return { controller, clock, credential, row, findFirst, repo, authority, input };
}
beforeEach(() => { vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-test-key-never-a-real-secret"); m.sites.mockReset(); m.sites.mockResolvedValue([site]); });
it("discovers only safe DTOs using scoped pending credentials and fresh authority", async () => {
 const f = fixture();
 expect(await discoverJiraSites(f.repo, f.input)).toEqual({ revision, sites: [{ id: site.id, name: site.name, url: site.url }] });
 expect(f.findFirst.mock.calls[0][0].where).toEqual({ id: "connection", organizationId: "tenant", provider: "jira", status: "pending", revokedAt: null });
 expect(m.sites).toHaveBeenCalledWith({ accessToken: "PRIVATE_ACCESS", signal: expect.any(AbortSignal) });
 expect(f.findFirst).toHaveBeenCalledTimes(2); expect(f.authority.mock.calls.length).toBeGreaterThanOrEqual(2);
});
it("prepares explicit fresh server selection without persisting or activating", async () => {
 const f = fixture(); const result = await prepareJiraSiteSelection(f.repo, { ...f.input, siteId: site.id });
 expect(result).toEqual({ connectionId: "connection", revision, site: { id: site.id, name: site.name, url: site.url } });
 expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.site)).toBe(true);
 expect(JSON.stringify(result)).not.toMatch(/PRIVATE|active|encrypted|scopes/);
});
it.each(["actor", "tenant", "user", "revoked", "status", "revision", "scopes", "expired", "decrypt", "connection"])("rejects invalid initial %s without provider I/O", async kind => {
 const f = fixture();
 if (kind === "actor") f.input.actor = { ...actor, canManageConnections: false };
 if (kind === "tenant") f.row.organizationId = "foreign";
 if (kind === "user") f.row.consentedByUserId = "other";
 if (kind === "revoked") f.row.revokedAt = new Date() as never;
 if (kind === "status") f.row.status = "active";
 if (kind === "revision") f.row.updatedAt = new Date(now + 1);
 if (kind === "scopes") f.row.scopesJson = ["write:jira-work"];
 if (kind === "expired") f.input.now = () => now + 60_000;
 if (kind === "decrypt") f.row.encryptedCredential = "PRIVATE_INVALID";
 if (kind === "connection") f.row.id = "foreign";
 await expect(discoverJiraSites(f.repo, f.input)).rejects.toThrow(/^jira_site_selection_unavailable$/); expect(m.sites).not.toHaveBeenCalled();
});
it.each(["revoked", "revision", "credential", "scopes", "authority", "tenant", "user", "expiry", "abort"])("rejects changed final %s after provider discovery", async kind => {
 const f = fixture();
 m.sites.mockImplementationOnce(async () => {
  if (kind === "revoked") f.row.revokedAt = new Date() as never;
  if (kind === "revision") f.row.updatedAt = new Date(now + 1);
  if (kind === "credential") f.row.encryptedCredential += "changed";
  if (kind === "scopes") f.row.scopesJson = ["read:jira-work"];
  if (kind === "authority") f.authority.mockResolvedValue({ ...actor, canManageConnections: false });
  if (kind === "tenant") f.authority.mockResolvedValue({ ...actor, organizationId: "foreign" });
  if (kind === "user") f.authority.mockResolvedValue({ ...actor, userId: "foreign" });
  if (kind === "expiry") f.clock.value = now + 60_000;
  if (kind === "abort") f.controller.abort();
  return [site];
 });
 await expect(prepareJiraSiteSelection(f.repo, { ...f.input, now: () => f.input.now(), siteId: site.id })).rejects.toThrow(/^jira_site_selection_unavailable$/);
});
it("does not accept unknown or client supplied site objects", async () => {
 const f = fixture(); const input = { ...f.input, siteId: "unknown", site }; await expect(prepareJiraSiteSelection(f.repo, input)).rejects.toThrow(/^jira_site_selection_unavailable$/);
});
it.each(["lookup", "authority", "provider"])("sanitizes %s failures", async kind => {
 const f = fixture();
 if (kind === "lookup") f.findFirst.mockRejectedValue(new Error("PRIVATE_DATABASE"));
 if (kind === "authority") f.authority.mockRejectedValue(new Error("PRIVATE_AUTH"));
 if (kind === "provider") m.sites.mockRejectedValue(new Error("PRIVATE_PROVIDER"));
 await expect(discoverJiraSites(f.repo, f.input)).rejects.toThrow(/^jira_site_selection_unavailable$/);
});
it("releases an aborted stalled authority read", async () => {
 const f = fixture(); f.authority.mockImplementation(() => new Promise(() => {}));
 const pending = discoverJiraSites(f.repo, f.input); f.controller.abort();
 await expect(pending).rejects.toThrow(/^jira_site_selection_unavailable$/); expect(m.sites).not.toHaveBeenCalled();
});
it("rechecks expiry immediately before provider I/O after authority lookup", async () => {
 const f = fixture(); let time = now; f.input.now = () => time;
 f.authority.mockImplementation(async () => { if (f.authority.mock.calls.length === 2) time = now + 60_000; return actor; });
 await expect(discoverJiraSites(f.repo, f.input)).rejects.toThrow(/^jira_site_selection_unavailable$/);
 expect(m.sites).not.toHaveBeenCalled();
});
it("snapshots caller revision for the safe discovery result", async () => {
 const f = fixture(); m.sites.mockImplementationOnce(async () => { f.input.revision = "PRIVATE_CHANGED"; return [site]; });
 expect((await discoverJiraSites(f.repo, f.input)).revision).toBe(revision);
});
it.each([
 { accessToken: "", refreshToken: null, expiresAt: now + 1000 },
 { accessToken: "PRIVATE\nTOKEN", refreshToken: null, expiresAt: now + 1000 },
 { accessToken: "PRIVATE", refreshToken: null, expiresAt: now },
 { accessToken: "PRIVATE", refreshToken: null, expiresAt: 1.5 },
 { accessToken: "PRIVATE", refreshToken: null, expiresAt: now + 1000, malicious: true },
])("rejects malformed or expired credential envelope %#", async token => {
 const f = fixture(); f.row.encryptedCredential = encryptScopedCredential(JSON.stringify(token), connectionCredentialContext({ organizationId: "tenant", provider: "jira", connectionId: "connection" }));
 await expect(discoverJiraSites(f.repo, f.input)).rejects.toThrow(/^jira_site_selection_unavailable$/); expect(m.sites).not.toHaveBeenCalled();
});
it("rejects a copied credential encrypted for a different tenant", async () => {
 const f = fixture(); f.row.encryptedCredential = encryptScopedCredential(JSON.stringify(f.credential), connectionCredentialContext({ organizationId: "foreign", provider: "jira", connectionId: "connection" }));
 await expect(discoverJiraSites(f.repo, f.input)).rejects.toThrow(/^jira_site_selection_unavailable$/); expect(m.sites).not.toHaveBeenCalled();
});
it.each([null, { ...actor, canManageConnections: false }, { ...actor, organizationId: "foreign" }, { ...actor, userId: "foreign" }])("rejects missing or mismatched fresh initial authority %#", async latest => {
 const f = fixture(); f.authority.mockImplementation(async () => latest as typeof actor);
 await expect(discoverJiraSites(f.repo, f.input)).rejects.toThrow(/^jira_site_selection_unavailable$/);
 expect(f.findFirst).not.toHaveBeenCalled(); expect(m.sites).not.toHaveBeenCalled();
});
it("refuses a missing pending connection", async () => {
 const f = fixture(); f.findFirst.mockResolvedValue(null as never);
 await expect(discoverJiraSites(f.repo, f.input)).rejects.toThrow(/^jira_site_selection_unavailable$/); expect(m.sites).not.toHaveBeenCalled();
});
it("releases an aborted stalled provider read without returning selection evidence", async () => {
 const f = fixture(); m.sites.mockImplementation(() => { f.controller.abort(); return new Promise(() => {}); });
 await expect(prepareJiraSiteSelection(f.repo, { ...f.input, siteId: site.id })).rejects.toThrow(/^jira_site_selection_unavailable$/);
});
it.each(["authority", "storage", "provider"])("bounds a stalled %s lookup with the server-owned total deadline", async stage => {
 vi.useFakeTimers();
 const deadlines: number[] = [];
 const deadline = vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
  deadlines.push(ms); const controller = new AbortController(); setTimeout(() => controller.abort(), ms); return controller.signal;
 });
 const f = fixture();
 if (stage === "authority") f.authority.mockImplementation(() => new Promise(() => {}));
 else if (stage === "storage") f.findFirst.mockImplementation(() => new Promise(() => {}));
 else m.sites.mockImplementation(() => new Promise(() => {}));
 let outcome = "pending";
 const pending = discoverJiraSites(f.repo, f.input).then(() => { outcome = "resolved"; }, error => { outcome = error.message; });
 try {
  await vi.advanceTimersByTimeAsync(15_000);
  expect(outcome).toBe("jira_site_selection_unavailable");
  expect(deadlines).toEqual([15_000]);
  if (stage === "provider") expect(m.sites.mock.calls[0][0].signal.aborted).toBe(true);
  else expect(m.sites).not.toHaveBeenCalled();
 } finally { f.controller.abort(); await pending; deadline.mockRestore(); vi.useRealTimers(); }
});
it("refuses revocation during the final fresh authority lookup", async () => {
 const f = fixture();
 f.authority.mockImplementation(async () => {
  if (f.authority.mock.calls.length === 3) { await Promise.resolve(); f.row.revokedAt = new Date() as never; }
  return actor;
 });
 await expect(prepareJiraSiteSelection(f.repo, { ...f.input, siteId: site.id })).rejects.toThrow(/^jira_site_selection_unavailable$/);
});
it("keeps the original authority reader and clock when caller input is replaced", async () => {
 const f = fixture();
 m.sites.mockImplementationOnce(async () => {
  Object.assign(f.input, { readCurrentActor: async () => null, now: () => now + 60_000 }); return [site];
 });
 expect((await discoverJiraSites(f.repo, f.input)).revision).toBe(revision);
 expect(f.authority).toHaveBeenCalledTimes(4);
});
it("retains the original cancellation signal when caller input is replaced", async () => {
 const f = fixture();
 m.sites.mockImplementationOnce(async () => {
  f.input.signal = new AbortController().signal; f.controller.abort(); return [site];
 });
 await expect(discoverJiraSites(f.repo, f.input)).rejects.toThrow(/^jira_site_selection_unavailable$/);
});
it.each(["revoked", "workspace", "user"])("refuses actor %s during the final pending-row read", async change => {
 const f = fixture();
 f.findFirst.mockImplementation(async () => {
  if (f.findFirst.mock.calls.length === 2) {
   await Promise.resolve();
   f.authority.mockResolvedValue(change === "revoked" ? { ...actor, canManageConnections: false } : change === "workspace" ? { ...actor, organizationId: "foreign" } : { ...actor, userId: "foreign" });
  }
  return f.row;
 });
 await expect(discoverJiraSites(f.repo, f.input)).rejects.toThrow(/^jira_site_selection_unavailable$/);
 expect(f.findFirst).toHaveBeenCalledTimes(2);
});
