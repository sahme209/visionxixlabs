import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { completeCallback, redeemTicket, safeCallback, signInReady, startSignIn, ticketHash, type AttemptRow, type ProviderRow, type SsoDeps } from "../tenantSsoService";
import { stateKey } from "../tenantOidc";

const ISSUER = "https://login.example-idp.com/t1/v2.0";
const DISCOVERY = { issuer: ISSUER, authorization_endpoint: "https://login.example-idp.com/authorize", token_endpoint: "https://login.example-idp.com/token", jwks_uri: "https://login.example-idp.com/keys" };
const REDIRECT = "https://visionxixlabs.com/api/sso/oidc/callback";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = { where?: any; data?: any };

async function setup(over: Partial<ProviderRow> = {}) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" }] };
  const provider: ProviderRow = {
    id: "idp_1", organizationId: "org_a", protocol: "oidc", status: "active", issuerOrEntityId: ISSUER, managedDomains: ["example.com"], verifiedDomains: ["example.com"],
    roleMappingJson: [{ claimKey: "groups", claimValue: "engineering", role: "operator" }], requireMfaClaim: false, oidcClientId: "client-1", encryptedClientSecret: "enc:secret", ...over,
  };
  const attempts: AttemptRow[] = [];
  const users = [{ id: "u_member", email: "member@example.com", name: "M", image: null }, { id: "u_outsider", email: "outsider@example.com", name: "O", image: null }];
  const memberships = [{ userId: "u_member", organizationId: "org_a" }];
  const scim: Array<{ organizationId: string; email: string; scimActive: boolean }> = [];
  const denied: string[] = [], seats: unknown[] = [];
  let idToken = "";
  let n = 0;
  const signToken = (claims: Record<string, unknown>) => new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(ISSUER).setAudience("client-1").setIssuedAt().setExpirationTime("5m").sign(privateKey);
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if ("gt" in o) return (row[k] as Date) > (o.gt as Date);
      if ("has" in o) return (row[k] as string[]).includes(o.has as string);
      if ("in" in o) return (o.in as unknown[]).includes(row[k]);
    }
    return row[k] === v;
  });
  const deps: SsoDeps = {
    db: {
      tenantIdentityProvider: {
        async findMany({ where }: Q) { return [provider].filter((p) => match(p as unknown as Record<string, unknown>, where)); },
        async findFirst({ where }: Q) { return [provider].find((p) => match(p as unknown as Record<string, unknown>, where)) ?? null; },
        async update({ data }: Q) { Object.assign(provider, data); return provider; },
      },
      ssoLoginAttempt: {
        async create({ data }: Q) { attempts.push({ consumedAt: null, ticketHash: null, userId: null, ticketExpiresAt: null, ticketConsumedAt: null, ...data } as AttemptRow); return data; },
        async findUnique({ where }: Q) { return attempts.find((a) => ("id" in where ? a.id === where.id : a.ticketHash === where.ticketHash)) ?? null; },
        async updateMany({ where, data }: Q) { const hit = attempts.filter((a) => match(a as unknown as Record<string, unknown>, where)); hit.forEach((a) => Object.assign(a, data)); return { count: hit.length }; },
      },
      scimProvisionedIdentity: { async findFirst({ where }: Q) { return scim.find((s) => match(s, where)) ? { id: "s" } : null; } },
      user: {
        async findUnique({ where }: Q) { return users.find((u) => ("email" in where ? u.email === where.email : u.id === where.id)) ?? null; },
        async create({ data }: Q) { const u = { id: `u_new_${++n}`, email: data.email, name: data.name, image: null }; users.push(u); return u; },
      },
      orgMembership: { async findUnique({ where }: Q) { return memberships.find((m) => m.userId === where.userId_organizationId.userId && m.organizationId === where.userId_organizationId.organizationId) ? { id: "m" } : null; } },
    } as unknown as SsoDeps["db"],
    encrypt: (p, c) => `${c}|${p}`,
    decrypt: (cipher, c) => { if (cipher === "enc:secret") return "the-secret"; if (!cipher.startsWith(`${c}|`)) throw new Error("context"); return cipher.slice(c.length + 1); },
    claimSeat: async (i) => { seats.push(i); memberships.push({ userId: i.userId, organizationId: i.organizationId }); return { ok: true }; },
    denied: async ({ reason }) => { denied.push(reason); },
    fetch: async (url) => (url.endsWith("openid-configuration") ? Response.json(DISCOVERY) : Response.json({ id_token: idToken })),
    jwks,
    now: () => new Date(),
  };
  /** Runs start then the IdP callback with a token carrying `claims`. */
  async function signIn(email: string, claims: Record<string, unknown>, mode: "signin" | "test" = "signin") {
    const start = await startSignIn(deps, { email, callbackUrl: "/desktop/pair/abc", redirectUri: REDIRECT, mode, testProviderId: "idp_1", testOrganizationId: "org_a" });
    if (!start.ok) return { start };
    const u = new URL(start.redirectUrl);
    const nonce = u.searchParams.get("nonce")!, state = u.searchParams.get("state")!;
    idToken = await signToken({ sub: "sub-1", nonce, ...claims });
    return { start, state, result: await completeCallback(deps, { state, code: "code-1", error: null, redirectUri: REDIRECT }) };
  }
  return { deps, provider, attempts, users, memberships, scim, denied, seats, signIn };
}

describe("company sign-in (OIDC)", () => {
  it("signs a new person in once: verified token, mapped role, seat claimed, one-time ticket", async () => {
    const t = await setup();
    const { result } = await t.signIn("new.person@example.com", { email: "new.person@example.com", groups: ["engineering"] });
    expect(result).toMatchObject({ ok: true, kind: "ticket", callbackUrl: "/desktop/pair/abc" });
    expect(t.seats).toEqual([expect.objectContaining({ organizationId: "org_a", role: "operator" })]);
    const ticket = (result as { ticket: string }).ticket;
    expect(t.attempts[0].ticketHash).toBe(ticketHash(ticket));
    expect(await redeemTicket(t.deps, ticket)).toMatchObject({ email: "new.person@example.com" });
    expect(await redeemTicket(t.deps, ticket)).toBeNull();
  });

  it("a callback can be used once only", async () => {
    const t = await setup();
    const { state } = await t.signIn("member@example.com", { email: "member@example.com", groups: ["engineering"] });
    expect(await completeCallback(t.deps, { state, code: "code-1", error: null, redirectUri: REDIRECT })).toEqual({ ok: false, reason: "sso.state_expired_or_used" });
    expect(await completeCallback(t.deps, { state: "x".repeat(43), code: "c", error: null, redirectUri: REDIRECT })).toEqual({ ok: false, reason: "sso.state_invalid" });
  });

  it("never takes over an existing account that is not already in the workspace", async () => {
    const t = await setup();
    const { result } = await t.signIn("outsider@example.com", { email: "outsider@example.com", groups: ["engineering"] });
    expect(result).toEqual({ ok: false, reason: "sso.existing_account_not_member" });
    expect(t.seats).toEqual([]);
  });

  it("refuses: no role mapping, a mapped owner role, someone SCIM deprovisioned", async () => {
    const t = await setup();
    expect((await t.signIn("member@example.com", { email: "member@example.com", groups: ["sales"] })).result).toEqual({ ok: false, reason: "sso.no_role_mapping" });
    t.provider.roleMappingJson = [{ claimKey: "groups", claimValue: "engineering", role: "owner" }];
    expect((await t.signIn("member@example.com", { email: "member@example.com", groups: ["engineering"] })).result).toEqual({ ok: false, reason: "sso.role_mapping_invalid" });
    t.provider.roleMappingJson = [{ claimKey: "groups", claimValue: "engineering", role: "operator" }];
    t.scim.push({ organizationId: "org_a", email: "member@example.com", scimActive: false });
    expect((await t.signIn("member@example.com", { email: "member@example.com", groups: ["engineering"] })).result).toEqual({ ok: false, reason: "sso.scim_deprovisioned" });
    expect(t.denied).toEqual(["sso.no_role_mapping", "sso.role_mapping_invalid", "sso.scim_deprovisioned"]);
  });

  it("only active connections with every domain DNS-verified can sign people in; public mail domains never", async () => {
    expect((await (await setup({ verifiedDomains: [] })).signIn("member@example.com", {})).start).toEqual({ ok: false, reason: "sso.no_provider_for_domain" });
    expect((await (await setup({ status: "pending" })).signIn("member@example.com", {})).start).toEqual({ ok: false, reason: "sso.no_provider_for_domain" });
    expect(signInReady({ ...(await setup()).provider, managedDomains: ["gmail.com"], verifiedDomains: ["gmail.com"] })).toBe(false);
  });

  it("an admin test of a pending connection records the result and signs no one in", async () => {
    const t = await setup({ status: "pending", verifiedDomains: [] });
    const { result } = await t.signIn("member@example.com", { email: "member@example.com" }, "test");
    expect(result).toEqual({ ok: true, kind: "test_passed", providerId: "idp_1" });
    expect(t.provider).toHaveProperty("lastTestAssertionAt");
    expect(t.seats).toEqual([]);
  });

  it("stores only a hash of the state and keeps the nonce and verifier encrypted", async () => {
    const t = await setup();
    const { start } = await t.signIn("member@example.com", { email: "member@example.com", groups: ["engineering"] });
    const state = new URL((start as { redirectUrl: string }).redirectUrl).searchParams.get("state")!;
    expect(t.attempts[0].id).toBe(stateKey(state));
    expect(t.attempts[0].encryptedSecrets.startsWith(`sso-attempt:${t.attempts[0].id}|`)).toBe(true);
  });

  it("keeps callback paths on this site", () => {
    expect(safeCallback("/desktop/pair/x")).toBe("/desktop/pair/x");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", 5]) expect(safeCallback(bad)).toBe("/control");
  });
});
