import "server-only";
import { z } from "zod";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "../tenantAuthorization";
import type { JiraAuthorizationActor } from "./jiraAuthorization";
import { readJiraAccessibleSites, selectJiraSite, type JiraSite } from "./jiraOAuth";

const unavailable = () => new Error("jira_site_selection_unavailable");
const id = z.string().min(1).max(512).refine(value => value.trim() === value && !/[\r\n]/.test(value));
const actorSchema = z.object({ organizationId: id, userId: id, canManageConnections: z.literal(true) });
const secret = z.string().min(1).max(65_536).refine(value => !/[\r\n]/.test(value));
const scopesSchema = z.array(z.enum(["read:jira-work", "offline_access"])).min(1).max(100)
  .refine(scopes => scopes.includes("read:jira-work") && new Set(scopes).size === scopes.length);
const rowSchema = z.object({ id, organizationId: id, provider: z.literal("jira"), status: z.literal("pending"),
  revokedAt: z.null(), consentedByUserId: id, updatedAt: z.date(), scopesJson: scopesSchema,
  encryptedCredential: z.string().min(1).max(262_144) });
const tokenSchema = z.object({ accessToken: secret, refreshToken: secret.nullable(), expiresAt: z.number().int().nonnegative().safe() }).strict();
const select = { id: true, organizationId: true, provider: true, status: true, revokedAt: true,
  consentedByUserId: true, updatedAt: true, scopesJson: true, encryptedCredential: true } as const;

/** Read-only repository: this service cannot persist, activate, or grant access. */
export interface JiraSiteSelectionRepository {
  tenantIntegrationConnection: {
    findFirst(args: { where: { id: string; organizationId: string; provider: "jira"; status: "pending"; revokedAt: null }; select: typeof select }): Promise<unknown>;
  };
}
export interface JiraSiteSelectionInput {
  actor: JiraAuthorizationActor | null;
  /** Must resolve current server-side membership and actor identity, not client claims. */
  readCurrentActor: () => Promise<JiraAuthorizationActor | null>;
  connectionId: string;
  /** Exact updatedAt ISO value from the pending connection. */
  revision: string;
  signal: AbortSignal;
  now?: () => number;
}
export type JiraSiteDTO = Readonly<Pick<JiraSite, "id" | "name" | "url">>;

async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void work.catch(() => undefined); throw unavailable(); }
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(unavailable()); };
    signal.addEventListener("abort", abort, { once: true });
    work.then(value => { signal.removeEventListener("abort", abort); signal.aborted ? reject(unavailable()) : resolve(value); }, () => {
      signal.removeEventListener("abort", abort); reject(unavailable());
    });
  });
}
const safeSite = (site: JiraSite): JiraSiteDTO => Object.freeze({ id: site.id, name: site.name, url: site.url });

async function inspect<T>(repo: JiraSiteSelectionRepository, input: JiraSiteSelectionInput, prepare: (sites: readonly JiraSite[]) => T) {
  try {
    const requestSignal = input.signal, clock = input.now ?? Date.now, readCurrentActor = input.readCurrentActor;
    if (requestSignal.aborted) throw unavailable();
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(15_000)]);
    // Copy authority before any await, so mutation of a caller-owned object
    // cannot change the tenant or initiating user midway through discovery.
    const actor = actorSchema.parse(input.actor), connectionId = id.parse(input.connectionId), revision = input.revision;
    if (typeof revision !== "string" || new Date(revision).toISOString() !== revision) throw unavailable();
    const now = () => {
      const value = clock();
      if (!Number.isSafeInteger(value) || value < 0 || signal.aborted) throw unavailable();
      return value;
    };
    const authority = async () => {
      const latest = actorSchema.parse(await abortable(readCurrentActor(), signal));
      if (latest.organizationId !== actor.organizationId || latest.userId !== actor.userId) throw unavailable();
    };
    const load = async () => {
      const row = rowSchema.parse(await abortable(repo.tenantIntegrationConnection.findFirst({
        where: { id: connectionId, organizationId: actor.organizationId, provider: "jira", status: "pending", revokedAt: null }, select,
      }), signal));
      const currentRevision = row.updatedAt.toISOString();
      if (row.id !== connectionId || row.organizationId !== actor.organizationId || row.consentedByUserId !== actor.userId || currentRevision !== revision) throw unavailable();
      return { encryptedCredential: row.encryptedCredential, revision: currentRevision, scopes: JSON.stringify(row.scopesJson) };
    };
    await authority();
    const before = await load();
    const plaintext = decryptScopedCredential(before.encryptedCredential, connectionCredentialContext({ organizationId: actor.organizationId, provider: "jira", connectionId }));
    if (plaintext.length > 262_144) throw unavailable();
    const token = tokenSchema.parse(JSON.parse(plaintext));
    if (token.expiresAt <= now()) throw unavailable();
    await authority();
    if (token.expiresAt <= now()) throw unavailable();
    const sites = await abortable(readJiraAccessibleSites({ accessToken: token.accessToken, signal }), signal);
    // Selection is prepared exclusively from this fresh server resource list.
    const result = prepare(sites);
    await authority();
    const after = await load();
    if (before.encryptedCredential !== after.encryptedCredential || before.revision !== after.revision || before.scopes !== after.scopes) throw unavailable();
    if (token.expiresAt <= now()) throw unavailable();
    // Final storage reads may outlive workspace membership or actor authority.
    // Preserve the row/revision comparison and recheck actor before disclosure.
    await authority();
    if (token.expiresAt <= now()) throw unavailable();
    return result;
  } catch { throw unavailable(); }
}

export async function discoverJiraSites(repo: JiraSiteSelectionRepository, input: JiraSiteSelectionInput): Promise<{ revision: string; sites: readonly JiraSiteDTO[] }> {
  const revision = input.revision;
  return inspect(repo, input, sites => Object.freeze({ revision,
    sites: Object.freeze(sites.map(site => safeSite(selectJiraSite(sites, site.id)))) }));
}

/** Prepared display/selection evidence only. A later scoped Jira health check
 * and atomic credential/revision CAS must precede activation or persistence.
 * This result is not an activation capability and contains no credentials. */
export async function prepareJiraSiteSelection(repo: JiraSiteSelectionRepository, input: JiraSiteSelectionInput & { siteId: string }): Promise<Readonly<{ connectionId: string; revision: string; site: JiraSiteDTO }>> {
  const connectionId = input.connectionId, revision = input.revision, siteId = input.siteId;
  return inspect(repo, input, sites => Object.freeze({ connectionId, revision, site: safeSite(selectJiraSite(sites, siteId)) }));
}
