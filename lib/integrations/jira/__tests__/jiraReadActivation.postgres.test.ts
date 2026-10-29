import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { realpathSync, statSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { activateJiraReadConnection, type JiraReadActivationRepository } from "../jiraReadActivation";
import { encryptScopedCredential, decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "../../tenantAuthorization";
import type { JiraAuthorizationActor } from "../jiraAuthorization";

const socket = process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
const cloudId = "12345678-1234-4234-8234-123456789abc";
const resourcesUrl = "https://api.atlassian.com/oauth/token/accessible-resources";
const scopedUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search?startAt=0&maxResults=1`;
const fixtureTime = Date.parse("2026-10-24T12:00:00.000Z");

/** Requires the same newly initialized, private, socket-only fixture as the
 * existing owned PostgreSQL gates. No inherited DATABASE_URL is consulted.
 * Every provider transport call is a fixed in-memory GET response; there is
 * deliberately no fallback to the real fetch implementation. */
describe.skipIf(!socket)("Jira read activation on owned real PostgreSQL", () => {
 let db: PrismaClient;
 let organizationId = "", userId = "", connectionId = "", revision = "", context = "";
 let clock: number;
 let token: { accessToken: string; refreshToken: string; expiresAt: number };
 let accessibleSites: Array<{ id: string; name: string; url: string; scopes: string[] }>;
 let fetcher: ReturnType<typeof vi.fn>;
 const ownedOrganizations = new Set<string>();
 const casCounts: number[] = [];
 const casCalls: Array<Parameters<JiraReadActivationRepository["tenantIntegrationConnection"]["updateMany"]>[0]> = [];

 function repository(afterCas?: (count: number) => Promise<void>): JiraReadActivationRepository {
  return { tenantIntegrationConnection: {
   findFirst: args => db.tenantIntegrationConnection.findFirst(args),
   updateMany: async args => {
    casCalls.push(args);
    const saved = await db.tenantIntegrationConnection.updateMany(args);
    casCounts.push(saved.count);
    await afterCas?.(saved.count);
    return saved;
   },
  } };
 }
 function authority(duringFinal?: () => Promise<void>, actorUserId = userId, actorOrganizationId = organizationId) {
  let reads = 0;
  return vi.fn(async (): Promise<JiraAuthorizationActor | null> => {
   if (++reads === 3) await duringFinal?.();
   const member = await db.orgMembership.findUnique({ where: { userId_organizationId: { userId: actorUserId, organizationId: actorOrganizationId } } });
   if (!member?.acceptedAt || !["owner", "admin"].includes(member.role)) return null;
   return { organizationId: actorOrganizationId, userId: actorUserId, canManageConnections: true };
  });
 }
 function input(readCurrentActor = authority(), actor = { organizationId, userId, canManageConnections: true }) {
  return { actor, readCurrentActor, connectionId, revision, siteId: cloudId, signal: new AbortController().signal, now: () => clock };
 }
 const stored = () => db.tenantIntegrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
 function barrier() {
  let arrivals = 0, release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  return async () => {
   if (++arrivals === 2) release();
   let timer: ReturnType<typeof setTimeout> | undefined;
   try { await Promise.race([ready, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("owned_jira_barrier_timeout")), 4000); })]); }
   finally { clearTimeout(timer); }
  };
 }
 beforeAll(async () => {
  if (!socket || !/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket ||
      (statSync(socket).mode & 0o077) !== 0 || statSync(socket).uid !== process.getuid?.()) throw Error("owned_private_socket_required");
  db = new PrismaClient({ datasources: { db: { url: `postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}` } } });
  const [binding] = await db.$queryRawUnsafe<Array<{ private: boolean }>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);
  if (!binding?.private) throw Error("owned_fixture_binding_required");
 });
 beforeEach(async () => {
  const suffix = randomUUID();
  organizationId = "owned_jira_activation_" + suffix; userId = "owned_jira_owner_" + suffix; connectionId = "owned_jira_connection_" + suffix;
  ownedOrganizations.clear(); ownedOrganizations.add(organizationId);
  clock = fixtureTime; casCounts.length = 0; casCalls.length = 0;
  // Random, fixture-local key exists only in this process and is restored in
  // finally cleanup. No real credential/key is loaded or printed.
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", randomBytes(48).toString("base64url"));
  token = { accessToken: "synthetic-jira-access-" + suffix, refreshToken: "synthetic-jira-refresh-" + suffix, expiresAt: clock + 60_000 };
  context = connectionCredentialContext({ organizationId, provider: "jira", connectionId });
  accessibleSites = [{ id: cloudId, name: "Owned fixture site", url: "https://owned-fixture.atlassian.net", scopes: ["read:jira-work"] }];
  fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
   // Every byte sent to a provider URL terminates here, never on a socket.
   const destination = String(url);
   expect([resourcesUrl, scopedUrl]).toContain(destination);
   expect(init?.method).toBe("GET"); expect(init?.redirect).toBe("error"); expect(init?.credentials).toBe("omit"); expect(init?.cache).toBe("no-store");
   expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${token.accessToken}`);
   if (destination === resourcesUrl) return Response.json(accessibleSites);
   if (destination === scopedUrl) return Response.json({ startAt: 0, maxResults: 1, total: 0, isLast: true, values: [] });
   throw Error("unexpected_owned_fixture_provider_transport");
  });
  vi.stubGlobal("fetch", fetcher);
  await db.orgMembership.create({ data: { organizationId, userId, role: "owner", acceptedAt: new Date(clock) } });
  const row = await db.tenantIntegrationConnection.create({ data: {
   id: connectionId, organizationId, provider: "jira", status: "pending", consentedByUserId: userId, revokedAt: null,
   scopesJson: ["read:jira-work", "offline_access"], encryptedCredential: encryptScopedCredential(JSON.stringify(token), context),
   externalAccountId: null, lastValidatedAt: null, updatedAt: new Date(clock),
  } });
  revision = row.updatedAt.toISOString();
 });
 afterEach(async () => {
  try {
   if (db) for (const ownedOrganizationId of ownedOrganizations) {
    if (!ownedOrganizationId.startsWith("owned_jira_activation_")) throw Error("owned_cleanup_scope_required");
    await db.tenantIntegrationConnection.deleteMany({ where: { organizationId: ownedOrganizationId, provider: "jira" } });
    await db.orgMembership.deleteMany({ where: { organizationId: ownedOrganizationId } });
   }
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
 });
 afterAll(async () => { if (db) await db.$disconnect(); });

 it("stores one read-only activation and a tenant/connection-bound encrypted selection", async () => {
  const before = await stored();
  expect(await activateJiraReadConnection(repository(), input())).toEqual({ connectionId, cloudId, readValidated: true, issueWritePermissionVerified: false });
  const after = await stored();
  expect(after).toMatchObject({ status: "active", organizationId, consentedByUserId: userId, externalAccountId: cloudId, lastValidatedAt: new Date(clock) });
  expect(after.scopesJson).toEqual(before.scopesJson); expect(after.encryptedCredential).not.toBe(before.encryptedCredential);
  expect(JSON.parse(decryptScopedCredential(after.encryptedCredential, context))).toEqual({ ...token, cloudId });
  for (const foreign of [connectionCredentialContext({ organizationId: organizationId + "-foreign", provider: "jira", connectionId }), connectionCredentialContext({ organizationId, provider: "jira", connectionId: connectionId + "-foreign" })]) {
   expect(() => decryptScopedCredential(after.encryptedCredential, foreign)).toThrow();
  }
  expect(casCounts).toEqual([1]); expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it("permits exactly one real pending-row CAS across concurrent activations", async () => {
  const meet = barrier();
  const results = await Promise.allSettled([
   activateJiraReadConnection(repository(), input(authority(meet))),
   activateJiraReadConnection(repository(), input(authority(meet))),
  ]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  expect(rejected.reason).toMatchObject({ message: "jira_read_activation_unavailable" });
  expect(casCounts.slice().sort()).toEqual([0, 1]); expect((await stored()).status).toBe("active");
  expect(fetcher).toHaveBeenCalledTimes(4);
 });
 it.each(["revision", "credential", "scopes", "revocation"] as const)("real CAS changes zero rows after %s changes during final authority", async change => {
  let changed: Awaited<ReturnType<typeof stored>> | undefined;
  const readCurrentActor = authority(async () => {
   changed = await db.tenantIntegrationConnection.update({ where: { id: connectionId }, data: {
    // Freeze revision for the other cases to independently exercise each CAS predicate.
    updatedAt: new Date(change === "revision" ? clock + 1 : revision),
    ...(change === "credential" ? { encryptedCredential: encryptScopedCredential(JSON.stringify({ ...token, accessToken: "synthetic-replaced-access" }), context) } : {}),
    ...(change === "scopes" ? { scopesJson: ["read:jira-work"] } : {}),
    ...(change === "revocation" ? { revokedAt: new Date(clock) } : {}),
   } });
  });
  await expect(activateJiraReadConnection(repository(), input(readCurrentActor))).rejects.toThrow(/^jira_read_activation_unavailable$/);
  expect(casCounts).toEqual([0]); expect(await stored()).toEqual(changed);
  expect((await stored()).status).toBe("pending"); expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it.each(["role", "membership"] as const)("revoked final %s authority dispatches no CAS", async change => {
  const before = await stored();
  const readCurrentActor = authority(async () => {
   await db.orgMembership.update({ where: { userId_organizationId: { userId, organizationId } }, data: change === "role" ? { role: "read_only" } : { acceptedAt: null } });
  });
  await expect(activateJiraReadConnection(repository(), input(readCurrentActor))).rejects.toThrow(/^jira_read_activation_unavailable$/);
  expect(casCalls).toHaveLength(0); expect(await stored()).toEqual(before);
 });
 it("reports a lost real CAS acknowledgment as unknown and rereads the committed active row", async () => {
  const repo = repository(async count => { if (count === 1) throw Error("synthetic_commit_acknowledgment_lost"); });
  await expect(activateJiraReadConnection(repo, input())).rejects.toThrow(/^jira_read_activation_outcome_unknown$/);
  const after = await stored();
  expect(after.status).toBe("active"); expect(after.externalAccountId).toBe(cloudId);
  expect(JSON.parse(decryptScopedCredential(after.encryptedCredential, context))).toEqual({ ...token, cloudId });
  // Reloading the real row prevents a replay from dispatching a second CAS or provider read.
  await expect(activateJiraReadConnection(repo, input())).rejects.toThrow(/^jira_read_activation_unavailable$/);
  expect(casCounts).toEqual([1]); expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it.each(["initial", "final"] as const)("refuses token expiry at the %s boundary without a CAS", async phase => {
  const before = await stored();
  if (phase === "initial") clock = token.expiresAt;
  const readCurrentActor = authority(phase === "final" ? async () => { clock = token.expiresAt; } : undefined);
  await expect(activateJiraReadConnection(repository(), input(readCurrentActor))).rejects.toThrow(/^jira_read_activation_unavailable$/);
  expect(casCalls).toHaveLength(0); expect(await stored()).toEqual(before);
  expect(fetcher).toHaveBeenCalledTimes(phase === "initial" ? 0 : 2);
 });
 it.each(["tenant", "consentingUser"] as const)("refuses a different %s before provider transport or CAS", async change => {
  const before = await stored();
  const otherUser = userId + "-other", otherOrganization = organizationId + "-foreign";
  if (change === "consentingUser") await db.orgMembership.create({ data: { organizationId, userId: otherUser, role: "admin", acceptedAt: new Date(clock) } });
  else {
   // A real authorized owner of another tenant still cannot target this row.
   ownedOrganizations.add(otherOrganization);
   await db.orgMembership.create({ data: { organizationId: otherOrganization, userId, role: "owner", acceptedAt: new Date(clock) } });
  }
  const actor = change === "tenant" ? { organizationId: otherOrganization, userId, canManageConnections: true } : { organizationId, userId: otherUser, canManageConnections: true };
  await expect(activateJiraReadConnection(repository(), input(authority(undefined, actor.userId, actor.organizationId), actor))).rejects.toThrow(/^jira_read_activation_unavailable$/);
  expect(casCalls).toHaveLength(0); expect(fetcher).not.toHaveBeenCalled(); expect(await stored()).toEqual(before);
 });
 it("requires the explicit selected site's fresh authenticated resource membership", async () => {
  const before = await stored(); accessibleSites = [];
  await expect(activateJiraReadConnection(repository(), input())).rejects.toThrow(/^jira_read_activation_unavailable$/);
  expect(casCalls).toHaveLength(0); expect(fetcher).toHaveBeenCalledTimes(1); expect(await stored()).toEqual(before);
 });
});
