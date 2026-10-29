import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { encryptScopedCredential, decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "../../tenantAuthorization";
const m = vi.hoisted(() => ({ sites: vi.fn() }));
vi.mock("../jiraOAuth", async original => ({ ...await original<typeof import("../jiraOAuth")>(), readJiraAccessibleSites: m.sites }));
import { activateJiraReadConnection, type JiraReadActivationRepository } from "../jiraReadActivation";
const actor = { organizationId: "tenant", userId: "owner", canManageConnections: true };
const revision = "2026-10-24T12:00:00.000Z", now = Date.parse(revision), cloudId = "12345678-1234-4234-8234-123456789abc";
const site = { id: cloudId, name: "Fixture", url: "https://fixture.atlassian.net", scopes: ["read:jira-work"] };
const context = connectionCredentialContext({ organizationId: "tenant", provider: "jira", connectionId: "connection" });
const page = { startAt: 0, maxResults: 1, total: 0, isLast: true, values: [] };
function fixture() {
 const controller = new AbortController(), clock = { value: now };
 const token = { accessToken: "PRIVATE_ACCESS", refreshToken: "PRIVATE_REFRESH", expiresAt: now + 60_000 };
 const row = { id: "connection", organizationId: "tenant", provider: "jira", status: "pending", revokedAt: null, consentedByUserId: "owner", updatedAt: new Date(revision), scopesJson: ["read:jira-work", "offline_access"], encryptedCredential: encryptScopedCredential(JSON.stringify(token), context) };
 const findFirst = vi.fn(async (_args: unknown) => row);
 const updateMany = vi.fn(async (args: unknown) => {
  const { where } = args as Parameters<JiraReadActivationRepository["tenantIntegrationConnection"]["updateMany"]>[0];
  const matches = row.id === where.id && row.organizationId === where.organizationId && row.provider === where.provider && row.status === where.status &&
   row.revokedAt === where.revokedAt && row.updatedAt.getTime() === where.updatedAt.getTime() && row.encryptedCredential === where.encryptedCredential &&
   row.consentedByUserId === where.consentedByUserId && JSON.stringify(row.scopesJson) === JSON.stringify(where.scopesJson.equals);
  return { count: matches ? 1 : 0 };
 });
 const repo = { tenantIntegrationConnection: { findFirst, updateMany } } as JiraReadActivationRepository;
 const authority = vi.fn(async () => actor);
 const input = { actor, readCurrentActor: authority, connectionId: "connection", revision, siteId: cloudId, signal: controller.signal, now: () => clock.value };
 return { controller, clock, token, row, findFirst, updateMany, repo, authority, input };
}
const fetcher = vi.fn();
beforeEach(() => { vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-test-key-never-a-real-secret"); m.sites.mockReset(); m.sites.mockResolvedValue([site]); fetcher.mockReset(); fetcher.mockResolvedValue(Response.json(page)); vi.stubGlobal("fetch", fetcher); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks(); });
it("activates only a freshly selected readable site with an exact pending credential CAS", async () => {
 const f = fixture();
 expect(await activateJiraReadConnection(f.repo, f.input)).toEqual({ connectionId: "connection", cloudId, readValidated: true, issueWritePermissionVerified: false });
 expect(fetcher).toHaveBeenCalledOnce();
 expect(fetcher).toHaveBeenCalledWith(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search?startAt=0&maxResults=1`, expect.objectContaining({ method: "GET", redirect: "error", credentials: "omit", cache: "no-store", headers: { accept: "application/json", authorization: "Bearer PRIVATE_ACCESS" } }));
 const update = f.updateMany.mock.calls[0][0] as { where: Record<string, unknown>; data: Record<string, unknown> };
 expect(update.where).toEqual({ id: "connection", organizationId: "tenant", provider: "jira", status: "pending", revokedAt: null, updatedAt: new Date(revision), encryptedCredential: f.row.encryptedCredential, consentedByUserId: "owner", scopesJson: { equals: f.row.scopesJson } });
 expect(update.data).toEqual({ status: "active", externalAccountId: cloudId, lastValidatedAt: new Date(now), encryptedCredential: expect.any(String) });
 expect(JSON.parse(decryptScopedCredential(update.data.encryptedCredential as string, context))).toEqual({ ...f.token, cloudId });
 expect(() => decryptScopedCredential(update.data.encryptedCredential as string, context + "foreign")).toThrow();
});
it.each(["unknownSite", "stale", "revoked", "expired", "wrongTenant", "wrongUser", "role", "scopes", "credentialContext"])("refuses initial %s before scoped provider I/O", async kind => {
 const f = fixture();
 if (kind === "unknownSite") f.input.siteId = "99999999-9999-4999-8999-999999999999";
 if (kind === "stale") f.row.updatedAt = new Date(now + 1);
 if (kind === "revoked") f.row.revokedAt = new Date() as never;
 if (kind === "expired") f.clock.value = now + 60_000;
 if (kind === "wrongTenant") f.row.organizationId = "foreign";
 if (kind === "wrongUser") f.row.consentedByUserId = "foreign";
 if (kind === "role") f.authority.mockResolvedValue({ ...actor, canManageConnections: false });
 if (kind === "scopes") f.row.scopesJson = ["write:jira-work"];
 if (kind === "credentialContext") f.row.encryptedCredential = encryptScopedCredential(JSON.stringify(f.token), context + "foreign");
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_unavailable$/);
 expect(fetcher).not.toHaveBeenCalled(); expect(f.updateMany).not.toHaveBeenCalled();
});
it.each(["role", "tenant", "user", "revoked", "credential", "revision", "scopes", "expired", "abort"])("refuses final %s changes before CAS", async kind => {
 const f = fixture();
 fetcher.mockImplementationOnce(async () => {
  if (kind === "role") f.authority.mockResolvedValue({ ...actor, canManageConnections: false });
  if (kind === "tenant") f.authority.mockResolvedValue({ ...actor, organizationId: "foreign" });
  if (kind === "user") f.authority.mockResolvedValue({ ...actor, userId: "foreign" });
  if (kind === "revoked") f.row.revokedAt = new Date() as never;
  if (kind === "credential") f.row.encryptedCredential += "changed";
  if (kind === "revision") f.row.updatedAt = new Date(now + 1);
  if (kind === "scopes") f.row.scopesJson = ["read:jira-work"];
  if (kind === "expired") f.clock.value = now + 60_000;
  if (kind === "abort") f.controller.abort();
  return Response.json(page);
 });
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_unavailable$/); expect(f.updateMany).not.toHaveBeenCalled();
});
it.each([
 () => new Response("private body", { status: 401 }),
 () => new Response("private body", { status: 302, headers: { location: "https://foreign.invalid" } }),
 () => Response.json({ ...page, values: [{}, {}] }),
 () => Response.json({ ...page, startAt: 1 }),
 () => Response.json({ error: "PRIVATE_PROVIDER" }),
 () => new Response("not json", { headers: { "content-type": "application/json" } }),
 () => new Response("{}", { headers: { "content-type": "text/html" } }),
 () => new Response("{}", { headers: { "content-type": "application/json", "content-length": "262145" } }),
 () => new Response(' '.repeat(262145), { headers: { "content-type": "application/json" } }),
 () => Object.defineProperty(Response.json(page), "redirected", { value: true }),
])("rejects invalid scoped read response %# without CAS", async response => {
 const f = fixture(); fetcher.mockImplementationOnce(async () => response());
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_unavailable$/);
 expect(f.updateMany).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledOnce();
});
it("refuses zero-count CAS without retry", async () => {
 const f = fixture(); f.updateMany.mockResolvedValue({ count: 0 });
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_unavailable$/);
 expect(f.updateMany).toHaveBeenCalledOnce(); expect(fetcher).toHaveBeenCalledOnce();
});
it("reports uncertain commit on a lost CAS response and never retries", async () => {
 const f = fixture(); f.updateMany.mockRejectedValue(new Error("PRIVATE_DB_REPLY_LOST"));
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_outcome_unknown$/);
 expect(f.updateMany).toHaveBeenCalledOnce(); expect(fetcher).toHaveBeenCalledOnce();
});
it.each(["revoked", "credential", "revision", "scopes"])("CAS refuses %s changes during final delayed authority lookup", async kind => {
 const f = fixture(); f.authority.mockImplementation(async () => {
  if (f.authority.mock.calls.length === 3) {
   await Promise.resolve();
   if (kind === "revoked") f.row.revokedAt = new Date() as never;
   if (kind === "credential") f.row.encryptedCredential += "changed";
   if (kind === "revision") f.row.updatedAt = new Date(now + 1);
   if (kind === "scopes") f.row.scopesJson = ["read:jira-work"];
  }
  return actor;
 });
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_unavailable$/);
 expect(f.updateMany).toHaveBeenCalledOnce();
 expect(await f.updateMany.mock.results[0].value).toEqual({ count: 0 });
 expect(f.row.status).toBe("pending");
});
it.each(["authority", "fetch", "body", "cas"])("bounds stalled %s with total deadline; CAS timeout remains unknown", async stage => {
 vi.useFakeTimers(); vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; });
 const f = fixture();
 if (stage === "authority") f.authority.mockImplementation(() => new Promise(() => {}));
 if (stage === "fetch") fetcher.mockImplementation(() => new Promise(() => {}));
 if (stage === "body") fetcher.mockResolvedValue(new Response(new ReadableStream({ cancel: () => new Promise(() => {}) }), { headers: { "content-type": "application/json" } }));
 if (stage === "cas") f.updateMany.mockImplementation(() => new Promise(() => {}));
 const pending = activateJiraReadConnection(f.repo, f.input); const rejected = expect(pending).rejects.toThrow(stage === "cas" ? /^jira_read_activation_outcome_unknown$/ : /^jira_read_activation_unavailable$/);
 await vi.advanceTimersByTimeAsync(15_000); await rejected;
 if (stage !== "cas") expect(f.updateMany).not.toHaveBeenCalled();
});

it("cannot use an anonymous-compatible scoped 200 without authenticated resource membership", async () => {
 const f = fixture(); m.sites.mockResolvedValue([]);
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_unavailable$/);
 expect(fetcher).not.toHaveBeenCalled(); expect(f.updateMany).not.toHaveBeenCalled();
});
it("accepts bounded project metadata without retaining project rows in activation output", async () => {
 const f = fixture(); fetcher.mockResolvedValue(Response.json({ ...page, total: 1, values: [{ id: "1", key: "FIX", name: "PRIVATE_PROJECT" }] }));
 expect(JSON.stringify(await activateJiraReadConnection(f.repo, f.input))).not.toContain("PRIVATE_PROJECT");
 expect(f.updateMany).toHaveBeenCalledOnce();
});
it("does not re-dispatch when a committed CAS reply was lost and current state is already active", async () => {
 const f = fixture(); f.updateMany.mockImplementation(async () => { f.row.status = "active"; throw new Error("PRIVATE_LOST_REPLY"); });
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_outcome_unknown$/);
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_unavailable$/);
 expect(fetcher).toHaveBeenCalledOnce(); expect(f.updateMany).toHaveBeenCalledOnce();
});
it("rejects expiry while the final authority lookup was delayed", async () => {
 const f = fixture(); f.authority.mockImplementation(async () => { if (f.authority.mock.calls.length === 3) f.clock.value = now + 60_000; return actor; });
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_unavailable$/); expect(f.updateMany).not.toHaveBeenCalled();
});
it("refuses authority revoked during the final storage lookup before dispatching CAS", async () => {
 const f = fixture();
 f.findFirst.mockImplementation(async () => {
  if (f.findFirst.mock.calls.length === 2) { await Promise.resolve(); f.authority.mockResolvedValue({ ...actor, canManageConnections: false }); }
  return f.row;
 });
 await expect(activateJiraReadConnection(f.repo, f.input)).rejects.toThrow(/^jira_read_activation_unavailable$/);
 expect(f.updateMany).not.toHaveBeenCalled();
});
