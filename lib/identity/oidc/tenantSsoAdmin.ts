/**
 * Admin steps that take a company OIDC or SAML connection from "pending" to "active":
 *  1. OIDC: setOidcClient stores the client id and encrypted secret (clears any earlier test).
 *     SAML: the IdP metadata saved with the connection must be usable (HTTPS SSO URL, signing cert).
 *  2. verifyDomains: each managed domain must publish a DNS TXT record proving the workspace owns it.
 *  3. A test sign-in (tenantSsoService, mode "test") must succeed.
 *  4. activate: only when all of the above hold and the test is less than 24 hours old.
 * No step returns the secret. Public mail domains can never be managed.
 */
import { createHash } from "node:crypto";
import { PUBLIC_EMAIL_DOMAINS, protocolConfigured, tenantClientSecretContext, type ProviderRow } from "./tenantSsoService";
import { discover } from "./tenantOidc";

export const TEST_MAX_AGE_MS = 24 * 60 * 60_000;
export const DNS_RECORD_PREFIX = "_v19-verification";

export interface AdminDb {
  tenantIdentityProvider: {
    findFirst(args: { where: Record<string, unknown> }): Promise<(ProviderRow & { lastTestAssertionAt: Date | null }) | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
}
export type AdminResult = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string, hint?: string): AdminResult => ({ status, body: { ok: false, error, ...(hint ? { hint } : {}) } });

/** The TXT value a workspace must publish at _v19-verification.<domain>. Bound to workspace and domain. */
export function domainVerificationValue(organizationId: string, domain: string): string {
  return `v19-domain-verification=${createHash("sha256").update(`v19-domain:${organizationId}:${domain.toLowerCase()}`).digest("hex").slice(0, 40)}`;
}

/** Fields safe to show in the cockpit and desktop: never the encrypted secret. */
export function publicProvider(p: ProviderRow & { lastTestAssertionAt: Date | null; createdAt?: Date; revokedAt?: Date | null }) {
  return {
    id: p.id, organizationId: p.organizationId, protocol: p.protocol, status: p.status, issuerOrEntityId: p.issuerOrEntityId,
    managedDomains: p.managedDomains, verifiedDomains: p.verifiedDomains, roleMappingJson: p.roleMappingJson, requireMfaClaim: p.requireMfaClaim,
    oidcClientId: p.oidcClientId, clientSecretSet: !!p.encryptedClientSecret, lastTestAssertionAt: p.lastTestAssertionAt,
    revokedAt: p.revokedAt ?? null, createdAt: p.createdAt ?? null,
    domainVerification: p.managedDomains.map((d) => ({ domain: d, record: `${DNS_RECORD_PREFIX}.${d}`, value: domainVerificationValue(p.organizationId, d), verified: p.verifiedDomains.includes(d) })),
  };
}

async function load(db: AdminDb, organizationId: string, id: string, protocol?: "oidc") {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return db.tenantIdentityProvider.findFirst({ where: { id, organizationId, ...(protocol ? { protocol } : {}), status: { in: ["pending", "active", "needs_attention"] } } });
}

export async function setOidcClient(db: AdminDb, deps: { encrypt(plain: string, context: string): string; fetch?: typeof fetch }, input: { organizationId: string; id: string; clientId: unknown; clientSecret: unknown }): Promise<AdminResult> {
  const p = await load(db, input.organizationId, input.id, "oidc");
  if (!p) return fail(404, "provider_not_found");
  if (typeof input.clientId !== "string" || !/^[\x21-\x7e]{1,256}$/.test(input.clientId.trim())) return fail(422, "client_id_invalid");
  if (typeof input.clientSecret !== "string" || input.clientSecret.length < 8 || input.clientSecret.length > 512 || /[\x00-\x1f]/.test(input.clientSecret)) return fail(422, "client_secret_invalid");
  try { await discover(p.issuerOrEntityId, deps.fetch); } catch { return fail(422, "issuer_unreachable", "V19 could not read this issuer's OpenID configuration over HTTPS."); }
  await db.tenantIdentityProvider.update({
    where: { id: p.id },
    data: { oidcClientId: input.clientId.trim(), encryptedClientSecret: deps.encrypt(input.clientSecret, tenantClientSecretContext(p.id)), lastTestAssertionAt: null, ...(p.status === "active" ? { status: "needs_attention" } : {}) },
  });
  return { status: 200, body: { ok: true, data: { id: p.id, clientSecretSet: true, testRequired: true } } };
}

export async function verifyDomains(db: AdminDb, resolveTxt: (name: string) => Promise<string[][]>, input: { organizationId: string; id: string }): Promise<AdminResult> {
  const p = await load(db, input.organizationId, input.id);
  if (!p) return fail(404, "provider_not_found");
  const results: Array<{ domain: string; verified: boolean; reason?: string }> = [];
  for (const domain of p.managedDomains) {
    if (PUBLIC_EMAIL_DOMAINS.has(domain)) { results.push({ domain, verified: false, reason: "public_mail_domain" }); continue; }
    try {
      const records = (await resolveTxt(`${DNS_RECORD_PREFIX}.${domain}`)).map((chunks) => chunks.join(""));
      results.push(records.includes(domainVerificationValue(p.organizationId, domain)) ? { domain, verified: true } : { domain, verified: false, reason: "record_not_found" });
    } catch {
      results.push({ domain, verified: false, reason: "record_not_found" });
    }
  }
  const verified = results.filter((r) => r.verified).map((r) => r.domain);
  await db.tenantIdentityProvider.update({ where: { id: p.id }, data: { verifiedDomains: verified } });
  return { status: 200, body: { ok: true, data: { results } } };
}

export async function activate(db: AdminDb, input: { organizationId: string; id: string; now: Date }): Promise<AdminResult> {
  const p = await load(db, input.organizationId, input.id);
  if (!p) return fail(404, "provider_not_found");
  if (p.status === "active") return { status: 200, body: { ok: true, data: { id: p.id, status: "active" } } };
  if (!protocolConfigured(p)) return fail(409, p.protocol === "saml" ? "saml_metadata_invalid" : "client_not_configured");
  const unverified = p.managedDomains.filter((d) => !p.verifiedDomains.includes(d) || PUBLIC_EMAIL_DOMAINS.has(d));
  if (p.managedDomains.length === 0 || unverified.length) return fail(409, "domains_not_verified", unverified.join(", "));
  if (!p.lastTestAssertionAt || input.now.getTime() - p.lastTestAssertionAt.getTime() > TEST_MAX_AGE_MS) return fail(409, "test_sign_in_required", "Run a test sign-in in the last 24 hours before activating.");
  await db.tenantIdentityProvider.update({ where: { id: p.id }, data: { status: "active" } });
  return { status: 200, body: { ok: true, data: { id: p.id, status: "active" } } };
}
