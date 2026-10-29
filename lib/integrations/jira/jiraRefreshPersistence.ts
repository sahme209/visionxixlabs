import {jiraRecordedScopesSchema} from '@/lib/integrations/jira/jiraRecordedScopes';
import "server-only";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { decryptScopedCredential, encryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "../tenantAuthorization";
import { refreshJiraToken } from "./jiraRefreshToken";
import type { JiraAuthorizationActor } from "./jiraAuthorization";

/** Internal persistence only, with no route or ambient credential/transport.
 * Existing needs_attention is a durable fail-closed lock: the encrypted unique
 * claim replaces the active envelope BEFORE token rotation. No timeout, retry,
 * process restart, or generic lease expiry can reopen it automatically.
 * A separate reviewed recovery mechanism is required for abandoned claims.
 */
const unavailable = () => new Error("jira_refresh_persistence_unavailable");
export class JiraRefreshPersistenceOutcomeUnknown extends Error {
 readonly retryAllowed = false;
 constructor() { super("jira_refresh_persistence_outcome_unknown"); this.name = "JiraRefreshPersistenceOutcomeUnknown"; }
}
const id = z.string().min(1).max(512).refine(value => value === value.trim() && !/[\x00-\x1f\x7f-\x9f]/.test(value));
const actorSchema = z.object({ organizationId: id, userId: id, canManageConnections: z.literal(true) });
const secret = z.string().min(1).max(65536).refine(value => value.trim().length > 0 && !/[\x00-\x1f\x7f-\x9f]/.test(value) && Buffer.byteLength(value, "utf8") <= 65536 && Buffer.from(value, "utf8").toString("utf8") === value);
const scopesSchema = jiraRecordedScopesSchema
 .refine(scopes => scopes.includes("read:jira-work") && new Set(scopes).size === scopes.length);
const tokenSchema = z.object({ accessToken: secret, refreshToken: secret, expiresAt: z.number().int().nonnegative().safe(), cloudId: z.string().uuid() }).strict();
const ciphertextSchema = z.string().min(1).max(262144);
const rowSchema = z.object({ id, organizationId: id, provider: z.literal("jira"), status: z.enum(["active", "needs_attention"]), revokedAt: z.null(),
 consentedByUserId: id, externalAccountId: z.string().uuid(), updatedAt: z.date(), lastValidatedAt: z.date().nullable(), scopesJson: scopesSchema,
 encryptedCredential: ciphertextSchema });
const select = { id: true, organizationId: true, provider: true, status: true, revokedAt: true, consentedByUserId: true,
 externalAccountId: true, updatedAt: true, lastValidatedAt: true, scopesJson: true, encryptedCredential: true } as const;
type ScopeWhere = { id: string; organizationId: string; provider: "jira"; status: "active" | "needs_attention"; revokedAt: null;
 consentedByUserId: string; externalAccountId: string; updatedAt: Date; encryptedCredential: string; scopesJson: { equals: string[] } };
export interface JiraRefreshRepository {
 tenantIntegrationConnection: {
  findFirst(args: { where: { id: string; organizationId: string; provider: "jira" }; select: typeof select }): Promise<unknown>;
  updateMany(args: { where: ScopeWhere; data: { status: "active" | "needs_attention"; encryptedCredential: string; updatedAt: Date; scopesJson?: string[] } }): Promise<{ count: number }>;
 };
}
async function bounded<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
 return new Promise((resolve, reject) => {
  const abort = () => { signal.removeEventListener("abort", abort); reject(unavailable()); };
  if (signal.aborted) { void work.catch(() => undefined); abort(); return; }
  signal.addEventListener("abort", abort, { once: true });
  work.then(value => { signal.removeEventListener("abort", abort); signal.aborted ? reject(unavailable()) : resolve(value); },
   () => { signal.removeEventListener("abort", abort); reject(unavailable()); });
 });
}
export async function refreshStoredJiraConnection(repo: JiraRefreshRepository, input: {
 actor: JiraAuthorizationActor | null; readCurrentActor: () => Promise<JiraAuthorizationActor | null>;
 connectionId: string; revision: string; clientId: string; clientSecret: string; transport: typeof fetch; signal: AbortSignal; now?: () => number;
}): Promise<Readonly<{ connectionId: string; revision: string; refreshed: boolean; connectionReadinessVerified: false }>> {
 let claimDispatched = false;
 try {
  const actor = actorSchema.parse(input.actor), connectionId = id.parse(input.connectionId), revision = input.revision;
  const { readCurrentActor, transport, signal: originalSignal, now: suppliedClock } = input;
  const clientId = id.parse(input.clientId), clientSecret = secret.parse(input.clientSecret), clock = suppliedClock ?? Date.now;
  if (typeof revision !== "string" || new Date(revision).toISOString() !== revision || originalSignal.aborted || typeof transport !== "function") throw unavailable();
  const signal = AbortSignal.any([originalSignal, AbortSignal.timeout(20000)]);
  const now = () => { const time = clock(); if (signal.aborted || !Number.isSafeInteger(time) || time < 0 || !Number.isFinite(new Date(time).getTime())) throw unavailable(); return time; };
  const authority = async () => {
   signal.throwIfAborted(); const latest = actorSchema.parse(await bounded(readCurrentActor(), signal));
   if (latest.organizationId !== actor.organizationId || latest.userId !== actor.userId) throw unavailable();
  };
  const load = async () => {
   signal.throwIfAborted(); const row = rowSchema.parse(await bounded(repo.tenantIntegrationConnection.findFirst({
    where: { id: connectionId, organizationId: actor.organizationId, provider: "jira" }, select }), signal));
   if (row.id !== connectionId || row.organizationId !== actor.organizationId || row.consentedByUserId !== actor.userId || !Number.isFinite(row.updatedAt.getTime())) throw unavailable();
   return row;
  };
  await authority(); const before = await load();
  if (before.status !== "active" || before.updatedAt.toISOString() !== revision) throw unavailable();
  const context = connectionCredentialContext({ organizationId: actor.organizationId, provider: "jira", connectionId });
  const token = tokenSchema.parse(JSON.parse(decryptScopedCredential(before.encryptedCredential, context)));
  if (token.cloudId !== before.externalAccountId) throw unavailable();
  await authority();
  if (token.expiresAt > now()) return Object.freeze({ connectionId, revision, refreshed: false, connectionReadinessVerified: false });
  const where: ScopeWhere = { id: connectionId, organizationId: actor.organizationId, provider: "jira", status: "active", revokedAt: null,
   consentedByUserId: actor.userId, externalAccountId: before.externalAccountId, updatedAt: before.updatedAt,
   encryptedCredential: before.encryptedCredential, scopesJson: { equals: before.scopesJson } };
  const claimedAt = new Date(now());
  const claimId = randomUUID();
  // Encryption/base64 + claim metadata can exceed a valid old envelope's bound.
  // Validate BOTH deterministic phase envelopes before locking the active row.
  let claimCipher = ciphertextSchema.parse(encryptScopedCredential(JSON.stringify({ kind: "jira_refresh_claim", claimId, phase: "reserved", token }), context));
  const dispatchCipher = ciphertextSchema.parse(encryptScopedCredential(JSON.stringify({ kind: "jira_refresh_claim", claimId, phase: "dispatching", token }), context));
  claimDispatched = true;
  const claimed = await bounded(repo.tenantIntegrationConnection.updateMany({ where,
   data: { status: "needs_attention", encryptedCredential: claimCipher, updatedAt: claimedAt } }), signal);
  if (claimed.count === 0) { claimDispatched = false; throw unavailable(); }
  if (claimed.count !== 1) throw unavailable();
  const matchesClaim = async () => {
   const row = await load();
   if (row.status !== "needs_attention" || row.updatedAt.getTime() !== claimedAt.getTime() || row.encryptedCredential !== claimCipher ||
    row.externalAccountId !== before.externalAccountId || JSON.stringify(row.scopesJson) !== JSON.stringify(before.scopesJson)) throw unavailable();
  };
  await matchesClaim(); await authority(); now();
  // Fence connection mutations DURING the final authority lookup. No awaited
  // operation separates this acknowledged owned-claim CAS from token dispatch.
  const dispatchClaim = await bounded(repo.tenantIntegrationConnection.updateMany({ where: { ...where, status: "needs_attention", updatedAt: claimedAt, encryptedCredential: claimCipher },
   data: { status: "needs_attention", encryptedCredential: dispatchCipher, updatedAt: claimedAt } }), signal);
  if (dispatchClaim.count !== 1) throw unavailable();
  claimCipher = dispatchCipher;
  const refreshed = await bounded(refreshJiraToken({ clientId, clientSecret, refreshToken: token.refreshToken,
   approvedScopes: [...before.scopesJson], signal, transport, now }), signal);
  // Defensively validate even an injected/test exchange result before storage.
  const nextToken = tokenSchema.parse({ accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken, expiresAt: refreshed.expiresAt, cloudId: token.cloudId });
  const nextScopes = scopesSchema.parse(refreshed.scopes);
  if (nextToken.refreshToken === token.refreshToken || nextScopes.some(scope => !before.scopesJson.includes(scope))) throw unavailable();
  const nextCipher = ciphertextSchema.parse(encryptScopedCredential(JSON.stringify(nextToken), context));
  await matchesClaim(); await authority();
  const completedAt = new Date(now()); if (nextToken.expiresAt <= completedAt.getTime()) throw unavailable();
  const saved = await bounded(repo.tenantIntegrationConnection.updateMany({ where: { ...where, status: "needs_attention", updatedAt: claimedAt, encryptedCredential: claimCipher },
   data: { status: "active", encryptedCredential: nextCipher, scopesJson: [...nextScopes], updatedAt: completedAt } }), signal);
  if (saved.count !== 1) throw unavailable();
  // Preserve lastValidatedAt and site; token rotation does not establish health.
  return Object.freeze({ connectionId, revision: completedAt.toISOString(), refreshed: true, connectionReadinessVerified: false });
 } catch { if (claimDispatched) throw new JiraRefreshPersistenceOutcomeUnknown(); throw unavailable(); }
}
