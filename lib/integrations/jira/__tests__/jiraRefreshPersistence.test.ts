import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { encryptScopedCredential, decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "../../tenantAuthorization";
const io = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("../jiraRefreshToken", async original => ({ ...await original<typeof import("../jiraRefreshToken")>(), refreshJiraToken: io.refresh }));
import { refreshStoredJiraConnection, JiraRefreshPersistenceOutcomeUnknown, type JiraRefreshRepository } from "../jiraRefreshPersistence";
const NOW = Date.parse("2026-10-24T18:00:00.000Z"), cloudId = "12345678-1234-4234-8234-123456789abc";
const actor = { organizationId: "tenant", userId: "consenter", canManageConnections: true };
function fixture() {
 const context = connectionCredentialContext({ organizationId: "tenant", provider: "jira", connectionId: "connection" });
 const token = { accessToken: "OLD_ACCESS", refreshToken: "OLD_REFRESH", expiresAt: NOW - 1, cloudId };
 const row = { id: "connection", organizationId: "tenant", provider: "jira", status: "active", revokedAt: null as Date | null, consentedByUserId: "consenter", externalAccountId: cloudId,
  updatedAt: new Date(NOW - 1000), lastValidatedAt: new Date(NOW - 2000), scopesJson: ["read:jira-work", "offline_access"], encryptedCredential: encryptScopedCredential(JSON.stringify(token), context) };
 const findFirst = vi.fn(async () => ({ ...row, scopesJson: [...row.scopesJson] }));
 const updateMany = vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
  const matches = Object.entries(where).every(([key, value]) => key === "scopesJson" ? JSON.stringify(row.scopesJson) === JSON.stringify((value as { equals: unknown }).equals) : value instanceof Date ? row[key as "updatedAt"] instanceof Date && (row[key as "updatedAt"] as Date).getTime() === value.getTime() : row[key as "id"] === value);
  if (!matches) return { count: 0 }; Object.assign(row, data); return { count: 1 };
 });
 const repo = { tenantIntegrationConnection: { findFirst, updateMany } } as unknown as JiraRefreshRepository;
 const authority = vi.fn(async () => actor), controller = new AbortController();
 const input = { actor, readCurrentActor: authority, connectionId: "connection", revision: row.updatedAt.toISOString(), clientId: "client", clientSecret: "PRIVATE_APP", transport: vi.fn(), signal: controller.signal, now: () => NOW };
 return { context, token, row, findFirst, updateMany, repo, authority, controller, input };
}
beforeEach(() => { vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-only-private-fixture-key"); io.refresh.mockReset().mockResolvedValue({ accessToken: "NEW_ACCESS", refreshToken: "NEW_REFRESH", expiresAt: NOW + 3600000, scopes: ["read:jira-work", "offline_access"], persistenceRequired: true, connectionReadinessVerified: false }); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks(); });
it("durably claims before token POST then installs an exact site-preserving rotated pair", async () => {
 const f = fixture(), lastValidated = f.row.lastValidatedAt;
 io.refresh.mockImplementation(async () => {
  expect(f.row.status).toBe("needs_attention"); const claim = JSON.parse(decryptScopedCredential(f.row.encryptedCredential, f.context));
  expect(claim).toMatchObject({ kind: "jira_refresh_claim", token: f.token }); expect(claim.claimId).toMatch(/^[a-f0-9-]{36}$/);
  return { accessToken: "NEW_ACCESS", refreshToken: "NEW_REFRESH", expiresAt: NOW + 3600000, scopes: ["read:jira-work"], persistenceRequired: true, connectionReadinessVerified: false };
 });
 expect(await refreshStoredJiraConnection(f.repo, f.input)).toMatchObject({ connectionId: "connection", refreshed: true, connectionReadinessVerified: false });
 expect(f.updateMany).toHaveBeenCalledTimes(3); expect(f.row.status).toBe("active"); expect(f.row.externalAccountId).toBe(cloudId); expect(f.row.lastValidatedAt).toEqual(lastValidated);
 expect(JSON.parse(decryptScopedCredential(f.row.encryptedCredential, f.context))).toEqual({ accessToken: "NEW_ACCESS", refreshToken: "NEW_REFRESH", expiresAt: NOW + 3600000, cloudId });
 expect(f.row.scopesJson).toEqual(["read:jira-work"]);
 expect(f.updateMany.mock.calls[0][0].where).toMatchObject({ organizationId: "tenant", id: "connection", provider: "jira", status: "active", revokedAt: null, consentedByUserId: "consenter", externalAccountId: cloudId, scopesJson: { equals: ["read:jira-work", "offline_access"] } });
 expect(f.updateMany.mock.calls[1][0].where).toMatchObject({ status: "needs_attention", encryptedCredential: f.updateMany.mock.calls[0][0].data.encryptedCredential });
 expect(f.updateMany.mock.calls[2][0].where).toMatchObject({ status: "needs_attention", encryptedCredential: f.updateMany.mock.calls[1][0].data.encryptedCredential });
});
it("returns current unexpired storage without changing it or refreshing", async () => {
 const f = fixture(); f.row.encryptedCredential = encryptScopedCredential(JSON.stringify({ ...f.token, expiresAt: NOW + 1000 }), f.context);
 expect(await refreshStoredJiraConnection(f.repo, f.input)).toMatchObject({ refreshed: false }); expect(f.updateMany).not.toHaveBeenCalled(); expect(io.refresh).not.toHaveBeenCalled();
});
it.each(["actor", "consenter", "tenant", "revision", "site", "revoked", "status", "refresh", "scopes"])("refuses invalid %s before a claim or POST", async change => {
 const f = fixture();
 if (change === "actor") f.authority.mockResolvedValue({ ...actor, canManageConnections: false });
 if (change === "consenter") f.row.consentedByUserId = "other";
 if (change === "tenant") f.row.organizationId = "foreign";
 if (change === "revision") f.row.updatedAt = new Date(NOW - 500);
 if (change === "site") f.row.externalAccountId = "22345678-1234-4234-8234-123456789abc";
 if (change === "revoked") f.row.revokedAt = new Date(NOW);
 if (change === "status") f.row.status = "needs_attention";
 if (change === "refresh") f.row.encryptedCredential = encryptScopedCredential(JSON.stringify({ ...f.token, refreshToken: null }), f.context);
 if (change === "scopes") f.row.scopesJson = ["write:jira-work"];
 await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toThrow(/^jira_refresh_persistence_unavailable$/); expect(f.updateMany).not.toHaveBeenCalled(); expect(io.refresh).not.toHaveBeenCalled();
});
it("allows one competing caller to claim and make a refresh request", async () => {
 const f = fixture(); const outcomes = await Promise.allSettled([refreshStoredJiraConnection(f.repo, f.input), refreshStoredJiraConnection(f.repo, f.input)]);
 expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1); expect(io.refresh).toHaveBeenCalledTimes(1); expect(f.row.status).toBe("active");
});
it("lost claim acknowledgment leaves a durable blocked claim and makes zero POSTs", async () => {
 const f = fixture(); const update = f.updateMany.getMockImplementation()!; f.updateMany.mockImplementationOnce(async args => { await update(args); throw Error("lost commit ACK"); });
 await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown); expect(f.row.status).toBe("needs_attention"); expect(io.refresh).not.toHaveBeenCalled();
 await expect(refreshStoredJiraConnection(f.repo, { ...f.input, revision: f.row.updatedAt.toISOString() })).rejects.toThrow(); expect(io.refresh).not.toHaveBeenCalled();
});
it("lost provider result leaves the claim blocked and never retries the token", async () => {
 const f = fixture(); io.refresh.mockRejectedValue(new Error("PRIVATE_PROVIDER_ERROR"));
 await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toMatchObject({ name: "JiraRefreshPersistenceOutcomeUnknown", message: "jira_refresh_persistence_outcome_unknown", retryAllowed: false });
 expect(f.row.status).toBe("needs_attention"); expect(f.updateMany).toHaveBeenCalledTimes(2); expect(io.refresh).toHaveBeenCalledTimes(1);
});
it.each(["actor", "revision", "ciphertext", "scopes", "consenter", "site", "revoked"])("never overwrites a changed %s after refresh", async change => {
 const f = fixture(); io.refresh.mockImplementation(async () => {
  if (change === "actor") f.authority.mockResolvedValue({ ...actor, canManageConnections: false });
  if (change === "revision") f.row.updatedAt = new Date(NOW + 1);
  if (change === "ciphertext") f.row.encryptedCredential += "changed";
  if (change === "scopes") f.row.scopesJson = ["read:jira-work"];
  if (change === "consenter") f.row.consentedByUserId = "other";
  if (change === "site") f.row.externalAccountId = "other";
  if (change === "revoked") { f.row.status = "revoked"; f.row.revokedAt = new Date(NOW); }
  return { accessToken: "NEW", refreshToken: "NEW_REFRESH", expiresAt: NOW + 3600000, scopes: ["read:jira-work"], persistenceRequired: true, connectionReadinessVerified: false };
 });
 await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown); expect(f.updateMany).toHaveBeenCalledTimes(2);
});
it("CAS fences connection revocation during final authority read", async () => {
 const f = fixture(); f.authority.mockImplementation(async () => { if (f.authority.mock.calls.length === 4) { f.row.status = "revoked"; f.row.revokedAt = new Date(NOW); } return actor; });
 await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown); expect(f.row.status).toBe("revoked");
});
it("lost final CAS acknowledgment remains unknown while reread sees rotated active storage", async () => {
 const f = fixture(); const update = f.updateMany.getMockImplementation()!; f.updateMany.mockImplementation(async args => { const saved = await update(args); if (f.updateMany.mock.calls.length === 3) throw Error("lost final ACK"); return saved; });
 await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown); expect(f.row.status).toBe("active"); expect(JSON.parse(decryptScopedCredential(f.row.encryptedCredential, f.context)).refreshToken).toBe("NEW_REFRESH"); expect(io.refresh).toHaveBeenCalledTimes(1);
});
it("blocks a connection revoked during the final authority read before provider dispatch", async () => {
 const f = fixture(); f.authority.mockImplementation(async () => { if (f.authority.mock.calls.length === 3) { f.row.status = "revoked"; f.row.revokedAt = new Date(NOW); } return actor; });
 await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
 expect(io.refresh).not.toHaveBeenCalled(); expect(f.row.status).toBe("revoked");
});

it("refuses an invalid platform secret before locking a connection", async () => {
 const f = fixture(); await expect(refreshStoredJiraConnection(f.repo, { ...f.input, clientSecret: "   " })).rejects.toThrow(/^jira_refresh_persistence_unavailable$/);
 expect(f.updateMany).not.toHaveBeenCalled(); expect(io.refresh).not.toHaveBeenCalled();
});
it("does not claim an aborted caller", async () => {
 const f = fixture(); f.controller.abort(); await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toThrow(/^jira_refresh_persistence_unavailable$/);
 expect(f.updateMany).not.toHaveBeenCalled(); expect(io.refresh).not.toHaveBeenCalled();
});
it("bounds a stalled storage claim and preserves unknown ownership without POST retry", async () => {
 vi.useFakeTimers(); const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => { const controller = new AbortController(); setTimeout(() => controller.abort(), ms); return controller.signal; });
 const f = fixture(); f.updateMany.mockImplementation(() => new Promise(() => {}));
 const pending = refreshStoredJiraConnection(f.repo, f.input); const rejected = expect(pending).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
 await vi.advanceTimersByTimeAsync(20001); await rejected; expect(io.refresh).not.toHaveBeenCalled(); expect(f.updateMany).toHaveBeenCalledTimes(1); timeout.mockRestore();
});
it.each(["reserved", "dispatching"] as const)("rejects oversized %s claim envelope before any persistent change", async boundary => {
 const f = fixture();
 const token = { ...f.token, accessToken: "\\".repeat(65536), refreshToken: "R".repeat(65400), expiresAt: 0 };
 const envelope = (phase: string) => encryptScopedCredential(JSON.stringify({ kind: "jira_refresh_claim", claimId: "a".repeat(36), phase, token }), f.context);
 if (boundary === "dispatching") {
  let found = false;
  for (let length = 65000; length <= 65536; length++) {
   token.refreshToken = "R".repeat(length);
   const predicted = (phase: string) => 3 + Math.ceil((new TextEncoder().encode(JSON.stringify({ kind: "jira_refresh_claim", claimId: "a".repeat(36), phase, token })).byteLength + 28) * 4 / 3);
   if (predicted("reserved") <= 262144 && predicted("dispatching") > 262144) { found = true; break; }
  }
  expect(found).toBe(true); expect(envelope("reserved").length).toBeLessThanOrEqual(262144);
 }
 expect(envelope(boundary).length).toBeGreaterThan(262144);
 const original = encryptScopedCredential(JSON.stringify(token), f.context); expect(original.length).toBeLessThanOrEqual(262144); f.row.encryptedCredential = original;
 await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toThrow(/^jira_refresh_persistence_unavailable$/);
 expect(f.updateMany).not.toHaveBeenCalled(); expect(io.refresh).not.toHaveBeenCalled(); expect(f.row.status).toBe("active"); expect(f.row.encryptedCredential).toBe(original);
});
it("never persists an oversized rotated token envelope after provider rotation", async () => {
 const f = fixture(); io.refresh.mockResolvedValue({ accessToken: "\\".repeat(65536), refreshToken: "R".repeat(65536), expiresAt: NOW + 3600000, scopes: ["read:jira-work"], persistenceRequired: true, connectionReadinessVerified: false });
 await expect(refreshStoredJiraConnection(f.repo, f.input)).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
 expect(f.updateMany).toHaveBeenCalledTimes(2); expect(f.row.status).toBe("needs_attention");
});
it('refreshes an explicitly stored write grant without acquiring further permissions',async()=>{const f=fixture();f.row.scopesJson=['read:jira-work','write:jira-work','offline_access'];io.refresh.mockResolvedValue({accessToken:'NEW_ACCESS',refreshToken:'NEW_REFRESH',expiresAt:NOW+3600000,scopes:[...f.row.scopesJson],persistenceRequired:true,connectionReadinessVerified:false});await expect(refreshStoredJiraConnection(f.repo,f.input)).resolves.toMatchObject({refreshed:true});expect(f.row.scopesJson).toContain('write:jira-work')});
