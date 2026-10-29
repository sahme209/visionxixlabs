import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { encryptScopedCredential, decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
const io = vi.hoisted(() => ({ lookup: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { tenantIntegrationConnection: { findUnique: io.lookup, findFirst: io.find, updateMany: io.update } } }));
import { readJiraCreateMetadata } from "../readJiraCreateMetadata";
const NOW = Date.parse("2026-10-24T18:20:00.000Z"), cloudId = "12345678-1234-4234-8234-123456789abc";
const tokenUrl = "https://auth.atlassian.com/oauth/token", metaUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/createmeta/KAN/issuetypes/10009?startAt=0&maxResults=50`;
const actor = { organizationId: "tenant", userId: "consenter", canManageConnections: true };
const context = connectionCredentialContext({ organizationId: "tenant", provider: "jira", connectionId: "connection" });
function fixture(expired = true) {
 const token = { accessToken: "OLD_ACCESS", refreshToken: "OLD_REFRESH", expiresAt: NOW + (expired ? -1 : 3600000), cloudId };
 const row = { id: "connection", organizationId: "tenant", provider: "jira", status: "active", revokedAt: null as Date | null, consentedByUserId: "consenter", externalAccountId: cloudId,
  scopesJson: ["read:jira-work", "offline_access"], updatedAt: new Date(NOW - 1000), lastValidatedAt: new Date(NOW - 2000), encryptedCredential: encryptScopedCredential(JSON.stringify(token), context) };
 const copy = () => ({ ...row, scopesJson: [...row.scopesJson] }); io.lookup.mockImplementation(async () => copy()); io.find.mockImplementation(async () => copy());
 io.update.mockImplementation(async ({ where, data }) => {
  const match = Object.entries(where).every(([key,value]) => key === "scopesJson" ? JSON.stringify(row.scopesJson) === JSON.stringify((value as {equals:unknown}).equals) : value instanceof Date ? (row[key as "updatedAt"] as Date).getTime() === value.getTime() : row[key as "id"] === value);
  if (!match) return { count: 0 }; Object.assign(row, data); return { count: 1 };
 });
 const authority = vi.fn(async () => actor);
 const transport = vi.fn<typeof fetch>(async (address, init) => {
  if (String(address) === tokenUrl) { expect(init?.method).toBe("POST"); return Response.json({ access_token: "NEW_ACCESS", refresh_token: "NEW_REFRESH", expires_in: 3600, scope: "read:jira-work offline_access" }); }
  expect(String(address)).toBe(metaUrl); expect(init?.method).toBe("GET");
  return Response.json({ startAt: 0, maxResults: 50, total: 1, fields: [{ fieldId: "summary", name: "Summary", required: true, hasDefaultValue: false, operations: ["set"], schema: { type: "string" } }] });
 });
 vi.stubGlobal("fetch", transport);
 const authorization = { actor, readCurrentActor: authority, connectionId: "connection", revision: row.updatedAt.toISOString(), refresh: { clientId: "client", clientSecret: "SYNTHETIC_APP_SECRET", transport } };
 const input = { organizationId: "tenant", projectIdOrKey: "KAN", issueTypeId: "10009", signal: new AbortController().signal, authorization };
 return { row, token, transport, authority, input };
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-metadata-refresh-test-vault-key"); vi.spyOn(Date, "now").mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("refreshes only expired authorized storage, then reads metadata with the durably rotated access token", async () => {
 const f = fixture(); const oldHealth = f.row.lastValidatedAt;
 expect(await readJiraCreateMetadata(f.input)).toMatchObject({ ok: true, connectionId: "connection", connectionRevision: new Date(NOW).toISOString(), metadata: { authority: "discovery_only", fields: [{ id: "summary" }] } });
 expect(f.transport.mock.calls.map(call => [String(call[0]), call[1]?.method])).toEqual([[tokenUrl,"POST"],[metaUrl,"GET"]]);
 expect(f.transport.mock.calls[1][1]?.headers).toMatchObject({ authorization: "Bearer NEW_ACCESS" }); expect(io.update).toHaveBeenCalledTimes(3); expect(f.row.lastValidatedAt).toEqual(oldHealth);
 expect(JSON.parse(decryptScopedCredential(f.row.encryptedCredential, context)).refreshToken).toBe("NEW_REFRESH");
});
it("unexpired authorized reads never call token refresh or mutate storage", async () => {
 const f = fixture(false); expect((await readJiraCreateMetadata(f.input)).ok).toBe(true); expect(io.update).not.toHaveBeenCalled(); expect(f.transport).toHaveBeenCalledTimes(1); expect(String(f.transport.mock.calls[0][0])).toBe(metaUrl);
});
it("legacy expired reads without explicit consenting authority remain unavailable", async () => {
 const f = fixture(); const {authorization:_authorization,...input}=f.input; expect((await readJiraCreateMetadata(input)).ok).toBe(false); expect(io.update).not.toHaveBeenCalled(); expect(f.transport).not.toHaveBeenCalled();
});
it.each(["viewer", "other_admin", "tenant", "connection", "revision", "site"])("refuses mismatched %s without any provider call", async change => {
 const f = fixture();
 if (change === "viewer") f.input.authorization.actor = { ...actor, canManageConnections: false };
 if (change === "other_admin") { f.input.authorization.actor = { ...actor, userId: "other" }; f.authority.mockResolvedValue({ ...actor, userId: "other" }); }
 if (change === "tenant") f.input.authorization.actor = { ...actor, organizationId: "foreign" };
 if (change === "connection") f.input.authorization.connectionId = "foreign";
 if (change === "revision") f.input.authorization.revision = new Date(NOW - 500).toISOString();
 if (change === "site") f.row.externalAccountId = "22345678-1234-4234-8234-123456789abc";
 expect((await readJiraCreateMetadata(f.input)).ok).toBe(false); expect(f.transport).not.toHaveBeenCalled(); expect(io.update).not.toHaveBeenCalled();
});
it("only one concurrent expired reader rotates and reaches metadata", async () => {
 const f = fixture(); const results = await Promise.all([readJiraCreateMetadata(f.input),readJiraCreateMetadata(f.input)]);
 expect(results.filter(result => result.ok)).toHaveLength(1); expect(f.transport.mock.calls.filter(call => String(call[0]) === tokenUrl)).toHaveLength(1);
 expect(f.transport.mock.calls.filter(call => String(call[0]) === metaUrl)).toHaveLength(1);
});
it("unknown rotation outcome returns no-retry metadata refusal and performs no GET", async () => {
 const f = fixture(); f.transport.mockRejectedValue(new Error("SYNTHETIC_LOST_RESPONSE"));
 expect(await readJiraCreateMetadata(f.input)).toEqual({ ok: false, error: "jira_refresh_persistence_outcome_unknown", retryAllowed: false });
 expect(f.transport).toHaveBeenCalledTimes(1); expect(f.row.status).toBe("needs_attention");
});
it("revoked consenter after refresh cannot receive metadata or trigger another request", async () => {
 const f = fixture(); const original = f.transport.getMockImplementation()!;
 f.transport.mockImplementation(async (address,init) => { const result=await original(address,init); if(String(address)===tokenUrl)f.authority.mockResolvedValue({ ...actor, canManageConnections:false }); return result; });
 expect((await readJiraCreateMetadata(f.input)).ok).toBe(false); expect(f.transport.mock.calls.filter(call=>String(call[0])===metaUrl)).toHaveLength(0);
});
it("rechecks actor after final metadata row read before returning discovery", async () => {
 const f=fixture(false); let lookups=0; io.lookup.mockImplementation(async()=>{ if(++lookups===2)f.authority.mockResolvedValue({ ...actor, canManageConnections:false }); return { ...f.row }; });
 expect((await readJiraCreateMetadata(f.input)).ok).toBe(false);
});
it("does not switch sites if the post-refresh reload replaces both stored site and encrypted cloud identity", async () => {
 const f=fixture(); let lookups=0;
 io.lookup.mockImplementation(async()=>{
  if(++lookups===2){
   const cloudId="22345678-1234-4234-8234-123456789abc";
   f.row.externalAccountId=cloudId;
   f.row.encryptedCredential=encryptScopedCredential(JSON.stringify({accessToken:"REPLACED_ACCESS",refreshToken:"REPLACED_REFRESH",expiresAt:NOW+3600000,cloudId}),context);
  }
  return {...f.row};
 });
 const original=f.transport.getMockImplementation()!;
 f.transport.mockImplementation(async(address,init)=>String(address)===tokenUrl ? original(address,init) : Response.json({startAt:0,maxResults:50,total:0,fields:[]}));
 expect((await readJiraCreateMetadata(f.input)).ok).toBe(false);
 expect(f.transport.mock.calls.filter(call=>String(call[0])!==tokenUrl)).toHaveLength(0);
});
it('reads unexpired metadata with already recorded read/write consent without refresh or writes',async()=>{const f=fixture(false);f.row.scopesJson.push('write:jira-work');expect((await readJiraCreateMetadata(f.input)).ok).toBe(true);expect(f.transport).toHaveBeenCalledTimes(1);expect(f.transport.mock.calls[0][1]?.method).toBe('GET');expect(io.update).not.toHaveBeenCalled()});
