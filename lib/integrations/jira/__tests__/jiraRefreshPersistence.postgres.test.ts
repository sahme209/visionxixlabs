import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { realpathSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@/lib/prismaClient";
import { encryptScopedCredential, decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "../../tenantAuthorization";
import { refreshStoredJiraConnection, JiraRefreshPersistenceOutcomeUnknown, type JiraRefreshRepository } from "../jiraRefreshPersistence";
import type { JiraAuthorizationActor } from "../jiraAuthorization";
const socket = process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
const cloudId = "12345678-1234-4234-8234-123456789abc", endpoint = "https://auth.atlassian.com/oauth/token";

/** Actual Prisma CAS/vault/membership, only on the canonical freshly created
 * private UNIX fixture. Token endpoint is ALWAYS injected fixed in-memory POST;
 * never ambient fetch, real tokens, process DB URL, cloud account or provider IO. */
describe.skipIf(!socket)("Jira rotating-token persistence on owned PostgreSQL", () => {
 let db: PrismaClient;
 let organizationId = "", userId = "", connectionId = "", context = "", revision = "", clock = 0;
 let token: { accessToken: string; refreshToken: string; expiresAt: number; cloudId: string };
 let transport: ReturnType<typeof vi.fn<typeof fetch>>;
 let duringPost: (() => Promise<void>) | undefined;
 const organizations = new Set<string>();
 const counts: number[] = [];
 const stored = () => db.tenantIntegrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
 function repository(afterSave?: (args: Parameters<JiraRefreshRepository["tenantIntegrationConnection"]["updateMany"]>[0], count: number, call: number) => Promise<void>, initialReadBarrier?: () => Promise<void>): JiraRefreshRepository {
  let calls = 0, reads = 0;
  return { tenantIntegrationConnection: {
   findFirst: async args => { const row = await db.tenantIntegrationConnection.findFirst(args); if (++reads === 1) await initialReadBarrier?.(); return row; },
   updateMany: async args => { const call = ++calls; const saved = await db.tenantIntegrationConnection.updateMany(args); counts.push(saved.count); await afterSave?.(args, saved.count, call); return saved; },
  } };
 }
 function authority(hook?: (read: number) => Promise<void>) {
  let reads = 0;
  return vi.fn(async (): Promise<JiraAuthorizationActor | null> => {
   await hook?.(++reads);
   const member = await db.orgMembership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
   return member?.acceptedAt && ["owner", "admin"].includes(member.role) ? { organizationId, userId, canManageConnections: true } : null;
  });
 }
 const input = (readCurrentActor = authority(), changed: Record<string, unknown> = {}) => ({ actor: { organizationId, userId, canManageConnections: true }, readCurrentActor,
  connectionId, revision, clientId: "synthetic-client", clientSecret: "SYNTHETIC_APP_SECRET", transport, signal: new AbortController().signal, now: () => clock, ...changed });
 const plaintext = async () => JSON.parse(decryptScopedCredential((await stored()).encryptedCredential, context));
 beforeAll(async () => {
  if (!socket || !/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket ||
   (statSync(socket).mode & 0o077) !== 0 || statSync(socket).uid !== process.getuid?.()) throw Error("owned_private_socket_required");
  db = createDatabaseClient(`postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`);
  const [binding] = await db.$queryRawUnsafe<Array<{ private: boolean }>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);
  if (!binding?.private) { await db.$disconnect(); throw Error("owned_fixture_binding_required"); }
 });
 beforeEach(async () => {
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-owned-refresh-vault-key-never-production");
  const suffix = randomUUID(); organizationId = `owned_refresh_${suffix}`; userId = `owned_consenter_${suffix}`; connectionId = `owned_connection_${suffix}`;
  organizations.add(organizationId); clock = Date.now(); revision = new Date(clock - 1000).toISOString(); counts.length = 0; duringPost = undefined;
  token = { accessToken: "SYNTHETIC_OLD_ACCESS", refreshToken: "SYNTHETIC_OLD_REFRESH", expiresAt: clock - 1, cloudId };
  context = connectionCredentialContext({ organizationId, provider: "jira", connectionId });
  await db.orgMembership.create({ data: { organizationId, userId, acceptedAt: new Date(clock), role: "owner" } });
  await db.tenantIntegrationConnection.create({ data: { id: connectionId, organizationId, provider: "jira", status: "active", revokedAt: null,
   consentedByUserId: userId, externalAccountId: cloudId, updatedAt: new Date(revision), lastValidatedAt: new Date(clock - 2000),
   scopesJson: ["read:jira-work", "offline_access"], encryptedCredential: encryptScopedCredential(JSON.stringify(token), context) } });
  transport = vi.fn<typeof fetch>(async (address, init) => {
   expect(String(address)).toBe(endpoint); expect(init).toMatchObject({ method: "POST", redirect: "error", credentials: "omit" });
   expect(JSON.parse(String(init?.body))).toEqual({ grant_type: "refresh_token", client_id: "synthetic-client", client_secret: "SYNTHETIC_APP_SECRET", refresh_token: token.refreshToken });
   // The durable dispatch claim MUST already exist when the actual exchange
   // primitive invokes the sole synthetic transport attempt.
   expect(await stored()).toMatchObject({ status: "needs_attention", revokedAt: null });
   expect(await plaintext()).toMatchObject({ kind: "jira_refresh_claim", phase: "dispatching", token });
   await duringPost?.();
   return Response.json({ access_token: "SYNTHETIC_NEW_ACCESS", refresh_token: "SYNTHETIC_NEW_REFRESH", expires_in: 3600, scope: "read:jira-work offline_access" });
  });
 });
 afterEach(() => { vi.unstubAllEnvs(); });
 afterAll(async () => {
  try { if (db) for (const org of organizations) { await db.tenantIntegrationConnection.deleteMany({ where: { organizationId: org } }); await db.orgMembership.deleteMany({ where: { organizationId: org } }); } }
  finally { if (db) await db.$disconnect(); }
 });
 it("commits the serialized rotating pair with the exact site/scopes and unchanged health timestamp", async () => {
  const before = await stored(); const result = await refreshStoredJiraConnection(repository(), input());
  expect(result).toEqual({ connectionId, revision: new Date(clock).toISOString(), refreshed: true, connectionReadinessVerified: false });
  expect(JSON.stringify(result)).not.toContain("SYNTHETIC"); expect(counts).toEqual([1, 1, 1]); expect(transport).toHaveBeenCalledTimes(1);
  expect(await stored()).toMatchObject({ status: "active", consentedByUserId: userId, externalAccountId: cloudId, lastValidatedAt: before.lastValidatedAt, scopesJson: before.scopesJson });
  expect(await plaintext()).toEqual({ accessToken: "SYNTHETIC_NEW_ACCESS", refreshToken: "SYNTHETIC_NEW_REFRESH", expiresAt: clock + 3600000, cloudId });
 });
 it("allows exactly one provider rotation from competing snapshots of the same active revision", async () => {
  let arrivals = 0, release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const barrier = async () => { if (++arrivals === 2) release(); await gate; };
  const results = await Promise.allSettled([refreshStoredJiraConnection(repository(undefined, barrier), input()), refreshStoredJiraConnection(repository(undefined, barrier), input())]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1); expect(transport).toHaveBeenCalledTimes(1);
  expect(counts.filter(count => count === 0)).toHaveLength(1); expect((await stored()).status).toBe("active"); expect((await plaintext()).refreshToken).toBe("SYNTHETIC_NEW_REFRESH");
 });
 it("exact old-ciphertext claim CAS refuses a concurrent credential change before dispatch", async () => {
  const changedCipher = encryptScopedCredential(JSON.stringify({ ...token, accessToken: "SYNTHETIC_OTHER" }), context);
  const actor = authority(async read => { if (read === 2) await db.tenantIntegrationConnection.update({ where: { id: connectionId }, data: { encryptedCredential: changedCipher, updatedAt: new Date(revision) } }); });
  await expect(refreshStoredJiraConnection(repository(), input(actor))).rejects.toThrow(/^jira_refresh_persistence_unavailable$/);
  expect(counts).toEqual([0]); expect(transport).not.toHaveBeenCalled(); expect((await stored()).encryptedCredential).toBe(changedCipher);
 });
 it("refuses revocation during the last pre-dispatch authority read with zero POSTs", async () => {
  const actor = authority(async read => { if (read === 3) await db.tenantIntegrationConnection.update({ where: { id: connectionId }, data: { status: "revoked", revokedAt: new Date(clock), updatedAt: new Date(clock) } }); });
  await expect(refreshStoredJiraConnection(repository(), input(actor))).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
  expect(counts).toEqual([1, 0]); expect(transport).not.toHaveBeenCalled(); expect((await stored()).status).toBe("revoked");
 });
 it.each(["scopes", "site", "revision", "consenter"])("does not overwrite %s changed during the rotating POST", async field => {
  duringPost = async () => { await db.tenantIntegrationConnection.update({ where: { id: connectionId }, data:
   field === "scopes" ? { scopesJson: ["read:jira-work"], updatedAt: new Date(clock) } : field === "site" ? { externalAccountId: "22345678-1234-4234-8234-123456789abc", updatedAt: new Date(clock) } : field === "revision" ? { updatedAt: new Date(clock + 1) } : { consentedByUserId: userId + "_other", updatedAt: new Date(clock) } }); };
  await expect(refreshStoredJiraConnection(repository(), input())).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
  expect(counts).toEqual([1, 1]); expect(transport).toHaveBeenCalledTimes(1); expect((await stored()).status).toBe("needs_attention");
 });
 it("final owned-claim CAS fences revocation during the last authority lookup", async () => {
  const actor = authority(async read => { if (read === 4) await db.tenantIntegrationConnection.update({ where: { id: connectionId }, data: { status: "revoked", revokedAt: new Date(clock), updatedAt: new Date(clock) } }); });
  await expect(refreshStoredJiraConnection(repository(), input(actor))).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
  expect(counts).toEqual([1, 1, 0]); expect(transport).toHaveBeenCalledTimes(1); expect((await stored()).status).toBe("revoked");
 });
 it("removed consenting membership during rotation blocks persistence", async () => {
  duringPost = async () => { await db.orgMembership.update({ where: { userId_organizationId: { userId, organizationId } }, data: { acceptedAt: null } }); };
  await expect(refreshStoredJiraConnection(repository(), input())).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
  expect(counts).toEqual([1, 1]); expect((await stored()).status).toBe("needs_attention");
 });
 it.each([1, 2])("lost phase-%s CAS acknowledgment prevents POST and never reopens the claim", async lostCall => {
  const repo = repository(async (_args, count, call) => { if (count === 1 && call === lostCall) throw Error("synthetic lost acknowledgment"); });
  await expect(refreshStoredJiraConnection(repo, input())).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
  expect((await stored()).status).toBe("needs_attention"); expect(transport).not.toHaveBeenCalled();
  await expect(refreshStoredJiraConnection(repository(), input(undefined, { revision: (await stored()).updatedAt.toISOString() }))).rejects.toThrow(/^jira_refresh_persistence_unavailable$/); expect(transport).not.toHaveBeenCalled();
 });
 it("a lost provider response leaves the durable claim blocked without a second rotation", async () => {
  transport.mockImplementation(async () => { throw Error("synthetic lost token response"); });
  await expect(refreshStoredJiraConnection(repository(), input())).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
  expect(counts).toEqual([1, 1]); expect((await stored()).status).toBe("needs_attention"); expect(transport).toHaveBeenCalledTimes(1);
  await expect(refreshStoredJiraConnection(repository(), input(undefined, { revision: (await stored()).updatedAt.toISOString() }))).rejects.toThrow(); expect(transport).toHaveBeenCalledTimes(1);
 });
 it("lost final CAS acknowledgment is unknown, but reread sees durable active rotation", async () => {
  const repo = repository(async (args, count) => { if (count === 1 && args.data.status === "active") throw Error("synthetic lost final acknowledgment"); });
  await expect(refreshStoredJiraConnection(repo, input())).rejects.toBeInstanceOf(JiraRefreshPersistenceOutcomeUnknown);
  expect((await stored()).status).toBe("active"); expect((await plaintext()).refreshToken).toBe("SYNTHETIC_NEW_REFRESH");
  expect(await refreshStoredJiraConnection(repository(), input(undefined, { revision: (await stored()).updatedAt.toISOString() }))).toMatchObject({ refreshed: false }); expect(transport).toHaveBeenCalledTimes(1);
 });
 it("another tenant cannot claim, mutate, or refresh this connection", async () => {
  const before = await stored();
  await expect(refreshStoredJiraConnection(repository(), input(authority(), { actor: { organizationId: organizationId + "_foreign", userId, canManageConnections: true } }))).rejects.toThrow();
  expect(counts).toEqual([]); expect(transport).not.toHaveBeenCalled(); expect(await stored()).toEqual(before);
 });
});
