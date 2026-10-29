import "server-only";
import { z } from "zod";
import { decryptScopedCredential, encryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "../tenantAuthorization";
import { readJiraAccessibleSites, selectJiraSite } from "./jiraOAuth";
import type { JiraSiteSelectionInput, JiraSiteSelectionRepository } from "./jiraSiteSelection";

const unavailable = () => new Error("jira_read_activation_unavailable");
/** A dispatched local CAS may have committed. Reload current connection state;
 * never retry activation automatically or treat this as a confirmed failure. */
export class JiraReadActivationOutcomeUnknown extends Error {
  constructor() { super("jira_read_activation_outcome_unknown"); this.name = "JiraReadActivationOutcomeUnknown"; }
}
const id = z.string().min(1).max(512).refine(value => value.trim() === value && !/[\r\n]/.test(value));
const actorSchema = z.object({ organizationId: id, userId: id, canManageConnections: z.literal(true) });
const secret = z.string().min(1).max(65_536).refine(value => !/[\r\n]/.test(value));
const scopesSchema = z.array(z.enum(["read:jira-work", "offline_access"])).min(1).max(2)
  .refine(scopes => scopes.includes("read:jira-work") && new Set(scopes).size === scopes.length);
const rowSchema = z.object({ id, organizationId: id, provider: z.literal("jira"), status: z.literal("pending"), revokedAt: z.null(),
  consentedByUserId: id, updatedAt: z.date(), scopesJson: scopesSchema, encryptedCredential: z.string().min(1).max(262_144) });
const tokenSchema = z.object({ accessToken: secret, refreshToken: secret.nullable(), expiresAt: z.number().int().nonnegative().safe() }).strict();
const select = { id: true, organizationId: true, provider: true, status: true, revokedAt: true,
  consentedByUserId: true, updatedAt: true, scopesJson: true, encryptedCredential: true } as const;
export interface JiraReadActivationRepository {
  tenantIntegrationConnection: JiraSiteSelectionRepository["tenantIntegrationConnection"] & {
    updateMany(args: { where: { id: string; organizationId: string; provider: "jira"; status: "pending"; revokedAt: null;
      updatedAt: Date; encryptedCredential: string; consentedByUserId: string; scopesJson: { equals: string[] } };
      data: { status: "active"; externalAccountId: string; lastValidatedAt: Date; encryptedCredential: string } }): Promise<{ count: number }>;
  };
}
async function bounded<T>(work: Promise<T>, signal: AbortSignal, discard?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(unavailable()); };
    if (signal.aborted) reject(unavailable());
    else signal.addEventListener("abort", abort, { once: true });
    work.then(value => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) { discard?.(value); reject(unavailable()); } else resolve(value);
    }, () => { signal.removeEventListener("abort", abort); reject(unavailable()); });
  });
}

/** Official project/search supports read:jira-work but can be anonymous:
 * https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/#api-rest-api-3-project-search-get
 * A well-formed 200 here establishes connectivity only. Authenticated fresh
 * accessible-resources membership is required separately. No writes or retries. */
async function checkScopedRead(accessToken: string, cloudId: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search?startAt=0&maxResults=1`;
  const response = await bounded(fetch(url, { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
    redirect: "error", credentials: "omit", cache: "no-store", signal }), signal, late => { void late.body?.cancel().catch(() => undefined); });
  const cancel = () => { void response.body?.cancel().catch(() => undefined); };
  const length = response.headers.get("content-length");
  if (response.status !== 200 || response.redirected || response.url && response.url !== url || !response.body ||
      response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
      length !== null && (!/^\d+$/.test(length) || Number(length) > 262_144)) { cancel(); throw unavailable(); }
  const reader = response.body.getReader(); let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await bounded(reader.read(), signal);
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 262_144) throw unavailable();
      chunks.push(next.value);
    }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    const result = z.object({ startAt: z.literal(0), maxResults: z.literal(1), total: z.number().int().nonnegative().safe(), isLast: z.boolean(),
      values: z.array(z.object({ id: z.string().min(1).max(128), key: z.string().min(1).max(128), name: z.string().min(1).max(512) })).max(1) })
      .parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
    if (result.total < result.values.length) throw unavailable();
    signal.throwIfAborted();
  } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** Server-only pending→read-validated CAS. A caller cannot supply provider site
 * evidence, token contents, expanded scopes, timestamps or activation status.
 * Active here means read validation only, never issue creation/close authority. */
export async function activateJiraReadConnection(repo: JiraReadActivationRepository, input: JiraSiteSelectionInput & { siteId: string }): Promise<Readonly<{
  connectionId: string; cloudId: string; readValidated: true; issueWritePermissionVerified: false;
}>> {
  let casDispatched = false;
  try {
    const requestSignal = input.signal, clock = input.now ?? Date.now, readCurrentActor = input.readCurrentActor;
    if (requestSignal.aborted) throw unavailable();
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(15_000)]);
    const actor = actorSchema.parse(input.actor), connectionId = id.parse(input.connectionId), revision = input.revision, siteId = z.string().uuid().parse(input.siteId);
    if (typeof revision !== "string" || new Date(revision).toISOString() !== revision) throw unavailable();
    const now = () => { const value = clock(); if (signal.aborted || !Number.isSafeInteger(value) || value < 0) throw unavailable(); return value; };
    const authority = async () => {
      signal.throwIfAborted(); const latest = actorSchema.parse(await bounded(readCurrentActor(), signal));
      if (latest.organizationId !== actor.organizationId || latest.userId !== actor.userId) throw unavailable();
    };
    const load = async () => {
      signal.throwIfAborted();
      const row = rowSchema.parse(await bounded(repo.tenantIntegrationConnection.findFirst({ where: {
        id: connectionId, organizationId: actor.organizationId, provider: "jira", status: "pending", revokedAt: null }, select }), signal));
      if (row.id !== connectionId || row.organizationId !== actor.organizationId || row.consentedByUserId !== actor.userId || row.updatedAt.toISOString() !== revision) throw unavailable();
      return row;
    };
    await authority(); const before = await load();
    const context = connectionCredentialContext({ organizationId: actor.organizationId, provider: "jira", connectionId });
    const plaintext = decryptScopedCredential(before.encryptedCredential, context);
    if (plaintext.length > 262_144) throw unavailable();
    const token = tokenSchema.parse(JSON.parse(plaintext));
    const unexpired = () => { const time = now(); if (token.expiresAt <= time) throw unavailable(); return time; };
    unexpired(); await authority(); unexpired();
    const sites = await bounded(readJiraAccessibleSites({ accessToken: token.accessToken, signal }), signal);
    const selected = selectJiraSite(sites, siteId);
    unexpired(); await checkScopedRead(token.accessToken, selected.id, signal);
    const after = await load();
    if (before.encryptedCredential !== after.encryptedCredential || before.updatedAt.toISOString() !== after.updatedAt.toISOString() ||
        JSON.stringify(before.scopesJson) !== JSON.stringify(after.scopesJson)) throw unavailable();
    // No awaited storage operation may separate this final authority check
    // from CAS dispatch. Connection changes during it are fenced atomically below.
    await authority();
    const encryptedCredential = encryptScopedCredential(JSON.stringify({ ...token, cloudId: selected.id }), context);
    const validatedAt = new Date(unexpired());
    const update = { where: { id: connectionId, organizationId: actor.organizationId, provider: "jira" as const, status: "pending" as const, revokedAt: null,
      updatedAt: new Date(revision), encryptedCredential: before.encryptedCredential, consentedByUserId: actor.userId, scopesJson: { equals: before.scopesJson } },
      data: { status: "active" as const, externalAccountId: selected.id, lastValidatedAt: validatedAt, encryptedCredential } };
    // From this exact point a rejected/late response has unknown commit status.
    // There is one local CAS and no automatic retry or compensating overwrite.
    casDispatched = true;
    const saved = await bounded(repo.tenantIntegrationConnection.updateMany(update), signal);
    if (saved.count === 0) { casDispatched = false; throw unavailable(); }
    if (saved.count !== 1 || signal.aborted) throw new JiraReadActivationOutcomeUnknown();
    return Object.freeze({ connectionId, cloudId: selected.id, readValidated: true, issueWritePermissionVerified: false });
  } catch {
    if (casDispatched) throw new JiraReadActivationOutcomeUnknown();
    throw unavailable();
  }
}
