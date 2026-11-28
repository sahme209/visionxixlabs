import { describe, expect, it } from "vitest";
import { activate, domainVerificationValue, publicProvider, setOidcClient, verifyDomains, type AdminDb } from "../tenantSsoAdmin";

const ISSUER = "https://login.example-idp.com/t1/v2.0";
const discovery = async () => Response.json({ issuer: ISSUER, authorization_endpoint: "https://login.example-idp.com/a", token_endpoint: "https://login.example-idp.com/t", jwks_uri: "https://login.example-idp.com/k" });
function store(over: Record<string, unknown> = {}) {
  const p = { id: "idp_1", organizationId: "org_a", protocol: "oidc", status: "pending", issuerOrEntityId: ISSUER, managedDomains: ["example.com", "example.org"], verifiedDomains: [] as string[], roleMappingJson: [], requireMfaClaim: false, oidcClientId: null as string | null, encryptedClientSecret: null as string | null, lastTestAssertionAt: null as Date | null, ...over };
  const db: AdminDb = {
    tenantIdentityProvider: {
      async findFirst({ where }) { return where.id === p.id && where.organizationId === p.organizationId && (where.status as { in: string[] }).in.includes(p.status) ? (p as never) : null; },
      async update({ data }) { Object.assign(p, data); return p; },
    },
  };
  return { p, db };
}
const enc = { encrypt: (plain: string, ctx: string) => `enc(${ctx})`, fetch: discovery as unknown as typeof fetch };

describe("company SSO admin steps", () => {
  it("stores the client secret encrypted, never returns it, and requires a new test", async () => {
    const { p, db } = store({ status: "active", lastTestAssertionAt: new Date() });
    const r = await setOidcClient(db, enc, { organizationId: "org_a", id: "idp_1", clientId: "client-1", clientSecret: "super-secret-value" });
    expect(r.body).toEqual({ ok: true, data: { id: "idp_1", clientSecretSet: true, testRequired: true } });
    expect(p).toMatchObject({ oidcClientId: "client-1", encryptedClientSecret: "enc(tenant-idp-client-secret:idp_1)", lastTestAssertionAt: null, status: "needs_attention" });
    expect(JSON.stringify(publicProvider(p as never))).not.toContain("enc(");
    expect((await setOidcClient(db, enc, { organizationId: "org_b", id: "idp_1", clientId: "c", clientSecret: "12345678" })).status).toBe(404);
    expect((await setOidcClient(db, enc, { organizationId: "org_a", id: "idp_1", clientId: "c", clientSecret: "short" })).body).toMatchObject({ error: "client_secret_invalid" });
  });

  it("verifies each domain by its workspace-bound DNS TXT record", async () => {
    const { p, db } = store();
    const txt = async (name: string) => (name === "_v19-verification.example.com" ? [[domainVerificationValue("org_a", "example.com")]] : name === "_v19-verification.example.org" ? [[domainVerificationValue("org_other", "example.org")]] : []);
    const r = await verifyDomains(db, txt, { organizationId: "org_a", id: "idp_1" });
    expect(r.body).toMatchObject({ data: { results: [{ domain: "example.com", verified: true }, { domain: "example.org", verified: false, reason: "record_not_found" }] } });
    expect(p.verifiedDomains).toEqual(["example.com"]);
  });

  it("activates only with a client, every domain verified and a test sign-in from the last 24 hours", async () => {
    const now = new Date("2026-11-28T12:00:00Z");
    const { p, db } = store();
    expect((await activate(db, { organizationId: "org_a", id: "idp_1", now })).body).toMatchObject({ error: "client_not_configured" });
    Object.assign(p, { oidcClientId: "c", encryptedClientSecret: "x" });
    expect((await activate(db, { organizationId: "org_a", id: "idp_1", now })).body).toMatchObject({ error: "domains_not_verified" });
    p.verifiedDomains = ["example.com", "example.org"];
    expect((await activate(db, { organizationId: "org_a", id: "idp_1", now })).body).toMatchObject({ error: "test_sign_in_required" });
    p.lastTestAssertionAt = new Date(now.getTime() - 25 * 3600_000);
    expect((await activate(db, { organizationId: "org_a", id: "idp_1", now })).body).toMatchObject({ error: "test_sign_in_required" });
    p.lastTestAssertionAt = new Date(now.getTime() - 3600_000);
    expect((await activate(db, { organizationId: "org_a", id: "idp_1", now })).body).toMatchObject({ ok: true, data: { status: "active" } });
    expect(p.status).toBe("active");
  });

  it("never verifies a public mail domain", async () => {
    const { p, db } = store({ managedDomains: ["gmail.com"] });
    await verifyDomains(db, async () => [[domainVerificationValue("org_a", "gmail.com")]], { organizationId: "org_a", id: "idp_1" });
    expect(p.verifiedDomains).toEqual([]);
  });
});

describe("provider list never exposes the client secret", () => {
  it("replaces the encrypted secret with clientSecretSet and adds the DNS records", async () => {
    const { buildIdentityProviderListResponse } = await import("../../identityProviderResponder");
    const row = { id: "idp_1", organizationId: "org_a", protocol: "oidc", status: "pending", issuerOrEntityId: ISSUER, managedDomains: ["example.com"], verifiedDomains: [], roleMappingJson: [], requireMfaClaim: false, lastTestAssertionAt: null, revokedAt: null, createdAt: new Date(), oidcClientId: "c", encryptedClientSecret: "v2:very-secret-cipher" };
    const r = await buildIdentityProviderListResponse({ tenantIdentityProvider: { findMany: async () => [row] } } as never, "org_a");
    const text = JSON.stringify(r.body);
    expect(text).not.toContain("very-secret-cipher");
    expect(text).not.toContain("encryptedClientSecret");
    expect(r.body).toMatchObject({ ok: true, data: { providers: [{ clientSecretSet: true, domainVerification: [{ domain: "example.com", record: "_v19-verification.example.com", verified: false }] }] } });
  });
});
