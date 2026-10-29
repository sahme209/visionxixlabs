import {jiraRecordedScopesSchema} from '@/lib/integrations/jira/jiraRecordedScopes';
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { collectJiraCreateMetadata } from "./jiraCreateMetadata";
import { refreshStoredJiraConnection, JiraRefreshPersistenceOutcomeUnknown, type JiraRefreshRepository } from "@/lib/integrations/jira/jiraRefreshPersistence";
import type { JiraAuthorizationActor } from "@/lib/integrations/jira/jiraAuthorization";

const unavailable = () => ({ ok: false as const, error: "jira_create_metadata_unavailable" as const });
const credentialSchema = z.object({
  cloudId: z.string().uuid(),
  accessToken: z.string().min(1).max(65536).refine(value => !/[\r\n]/.test(value)),
  expiresAt: z.number().int().positive(),
  refreshToken: z.string().min(1).max(65536).refine(value => !/[\r\n]/.test(value)).nullable().optional(),
}).strict();
const scopeSchema = z.array(z.string().min(1).max(128)).max(100);
const pageShape = z.object({ startAt: z.number().int().min(0).max(200), total: z.number().int().min(0).max(200),
  maxResults: z.number().int().min(1).max(200), fields: z.array(z.unknown()).max(200) });

async function untilAbort<T>(work: Promise<T>, signal: AbortSignal, discard?: (value: T) => void): Promise<T> {
  if (signal.aborted) throw new Error("aborted");
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => { cleanup(); reject(new Error("aborted")); };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(value => { cleanup(); if (signal.aborted) { discard?.(value); reject(new Error("aborted")); } else resolve(value); },
      () => { cleanup(); reject(new Error("read_failed")); });
  });
}

async function readPage(response: Response, signal: AbortSignal, limit: number): Promise<{ body: unknown; bytes: number }> {
  if (!response.ok || !response.body || response.redirected) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error("read_failed");
  }
  const advertised = response.headers.get("content-length");
  if (advertised && (!/^\d+$/.test(advertised) || Number(advertised) > limit)) {
    void response.body.cancel().catch(() => undefined);
    throw new Error("body_bound");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const item = await untilAbort(reader.read(), signal);
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > limit) throw new Error("body_bound");
      chunks.push(item.value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return { body: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)), bytes };
  } finally { void reader.cancel().catch(() => undefined); }
}

/** Internal discovery only. A public caller must require a current authorized actor.
 * No process-wide fallback, network-supplied URL, connection creation or issue write.
 */
export async function readJiraCreateMetadata(input: {
  organizationId: string; projectIdOrKey: string; issueTypeId: string; signal: AbortSignal;
  /** Explicit trusted consenting administrator only; never viewer/client claims.
   * Absence retains legacy fail-closed expiry behavior. No route is wired here. */
  authorization?: { actor: JiraAuthorizationActor | null; readCurrentActor: () => Promise<JiraAuthorizationActor | null>;
    connectionId: string; revision: string; refresh: { clientId: string; clientSecret: string; transport: typeof fetch } };
}) {
  try {
    const { organizationId, projectIdOrKey, issueTypeId, signal: requestSignal } = input;
    const actorShape = z.object({ organizationId: z.string().min(1).max(240), userId: z.string().min(1).max(512), canManageConnections: z.literal(true) });
    const supplied = input.authorization;
    const authorization = supplied === undefined ? undefined : {
      actor: actorShape.parse(supplied.actor), readCurrentActor: supplied.readCurrentActor,
      connectionId: z.string().min(1).max(512).parse(supplied.connectionId), revision: supplied.revision,
      refresh: { clientId: supplied.refresh.clientId, clientSecret: supplied.refresh.clientSecret, transport: supplied.refresh.transport },
    };
    let expectedRevision = authorization?.revision;
    if (authorization && (authorization.actor.organizationId !== organizationId || typeof authorization.readCurrentActor !== "function" ||
      typeof expectedRevision !== "string" || new Date(expectedRevision).toISOString() !== expectedRevision)) return unavailable();
    if (!organizationId || organizationId !== organizationId.trim() || organizationId.length > 240 ||
      !/^(?:[A-Z][A-Z0-9_]{0,99}|[0-9]{1,20})$/.test(projectIdOrKey) ||
      !/^[0-9]{1,20}$/.test(issueTypeId) || requestSignal.aborted) return unavailable();
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(15_000)]);
    const actorCurrent = async () => {
      if (!authorization) return;
      signal.throwIfAborted();
      const current = actorShape.parse(await untilAbort(authorization.readCurrentActor(), signal));
      if (current.organizationId !== organizationId || current.userId !== authorization.actor.userId) throw Error("authority_changed");
    };
    const owned = (row: { id: string; organizationId: string; updatedAt: Date; scopesJson: unknown; consentedByUserId?: string | null; externalAccountId?: string | null; provider?: string }) => {
      if (!authorization) return;
      const approved = jiraRecordedScopesSchema.parse(row.scopesJson);
      if (row.id !== authorization.connectionId || row.provider !== "jira" || row.organizationId !== organizationId ||
        row.consentedByUserId !== authorization.actor.userId || row.updatedAt.toISOString() !== expectedRevision ||
        !approved.includes("read:jira-work") || new Set(approved).size !== approved.length) throw Error("connection_changed");
    };
    await actorCurrent();
    const lookup = () => prisma.tenantIntegrationConnection.findUnique({
      where: { organizationId_provider: { organizationId, provider: "jira" } },
      select: { id: true, organizationId: true, provider: true, status: true, revokedAt: true, updatedAt: true, encryptedCredential: true, scopesJson: true, consentedByUserId: true, externalAccountId: true, lastValidatedAt: true },
    });
    let connection = await untilAbort(lookup(), signal);
    if (!connection || connection.organizationId !== organizationId || connection.status !== "active" || connection.revokedAt ||
      !connection.id || !Number.isFinite(connection.updatedAt.getTime())) return unavailable();
    owned(connection);
    const scopes = scopeSchema.safeParse(connection.scopesJson);
    if (!scopes.success || !(scopes.data.includes("read:jira-work") ||
      ["read:issue-meta:jira", "read:avatar:jira", "read:field-configuration:jira"].every(scope => scopes.data.includes(scope)))) return unavailable();
    let parsed = credentialSchema.safeParse(JSON.parse(decryptScopedCredential(connection.encryptedCredential,
      connectionCredentialContext({ organizationId, provider: "jira", connectionId: connection.id }))));
    if (!parsed.success) return unavailable();
    if (authorization && connection.externalAccountId !== parsed.data.cloudId) return unavailable();
    const originalCloudId = parsed.data.cloudId;
    const originalScopes = [...scopes.data];
    if (parsed.data.expiresAt <= Date.now()) {
      if (!authorization) return unavailable();
      let persisted;
      try {
        persisted = await refreshStoredJiraConnection(prisma as unknown as JiraRefreshRepository, {
          actor: authorization.actor, readCurrentActor: authorization.readCurrentActor, connectionId: connection.id,
          revision: connection.updatedAt.toISOString(), ...authorization.refresh, signal,
        });
      } catch (error) {
        if (error instanceof JiraRefreshPersistenceOutcomeUnknown) return { ok: false as const, error: "jira_refresh_persistence_outcome_unknown" as const, retryAllowed: false as const };
        return unavailable();
      }
      expectedRevision = persisted.revision;
      connection = await untilAbort(lookup(), signal);
      if (!connection || connection.status !== "active" || connection.revokedAt) return unavailable();
      owned(connection);
      parsed = credentialSchema.safeParse(JSON.parse(decryptScopedCredential(connection.encryptedCredential,
        connectionCredentialContext({ organizationId, provider: "jira", connectionId: connection.id }))));
      if (!parsed.success || parsed.data.expiresAt <= Date.now() || parsed.data.cloudId !== originalCloudId ||
        connection.externalAccountId !== originalCloudId ||
        !Array.isArray(connection.scopesJson) || connection.scopesJson.some(scope => typeof scope !== "string" || !originalScopes.includes(scope))) return unavailable();
    }
    const revision = connection.updatedAt.toISOString();
    const credential = parsed.data;
    const pages: unknown[] = [];
    let startAt = 0;
    let total: number | undefined;
    let received = 0;
    for (let count = 0; count < 10; count++) {
      await actorCurrent();
      if (credential.expiresAt <= Date.now() || signal.aborted) return unavailable();
      const url = new URL(`https://api.atlassian.com/ex/jira/${credential.cloudId}/rest/api/3/issue/createmeta/${projectIdOrKey}/issuetypes/${issueTypeId}`);
      url.searchParams.set("startAt", String(startAt)); url.searchParams.set("maxResults", "50");
      const response = await untilAbort(fetch(url.toString(), { method: "GET", redirect: "error", credentials: "omit", cache: "no-store", signal,
        headers: { accept: "application/json", authorization: `Bearer ${credential.accessToken}` } }), signal, late => { void late.body?.cancel().catch(() => undefined); });
      const read = await readPage(response, signal, Math.min(256 * 1024, 1024 * 1024 - received));
      received += read.bytes;
      const page = pageShape.safeParse(read.body);
      if (!page.success || page.data.startAt !== startAt || (total !== undefined && total !== page.data.total) ||
        page.data.fields.length > page.data.maxResults || startAt + page.data.fields.length > page.data.total) return unavailable();
      total = page.data.total; pages.push(read.body); startAt += page.data.fields.length;
      if (startAt === total) break;
      if (page.data.fields.length === 0) return unavailable();
    }
    const metadata = collectJiraCreateMetadata(pages);
    const current = await untilAbort(lookup(), signal);
    if (signal.aborted || credential.expiresAt <= Date.now() || !current || current.organizationId !== organizationId ||
      current.id !== connection.id || current.status !== "active" || current.revokedAt ||
      current.updatedAt.toISOString() !== revision || current.encryptedCredential !== connection.encryptedCredential ||
      JSON.stringify(current.scopesJson) !== JSON.stringify(connection.scopesJson)) return unavailable();
    owned(current);
    if (authorization && current.externalAccountId !== credential.cloudId) return unavailable();
    await actorCurrent();
    if (signal.aborted || credential.expiresAt <= Date.now()) return unavailable();
    return { ok: true as const, connectionId: connection.id, connectionRevision: revision, projectIdOrKey, issueTypeId, metadata };
  } catch { return unavailable(); }
}
