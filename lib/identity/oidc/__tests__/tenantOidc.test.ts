import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { authorizationRequest, discover, exchangeCode, stateKey, verifyIdToken, type OidcDiscovery } from "../tenantOidc";

const ISSUER = "https://login.example-idp.com/tenant-1/v2.0";
const doc: OidcDiscovery = { issuer: ISSUER, authorization_endpoint: "https://login.example-idp.com/authorize", token_endpoint: "https://login.example-idp.com/token", jwks_uri: "https://login.example-idp.com/keys" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function keys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const sign = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string } = {}) =>
    new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(opts.iss ?? ISSUER).setAudience(opts.aud ?? "client-1").setIssuedAt().setExpirationTime(opts.exp ?? "5m").sign(privateKey);
  return { jwks: { keys: [jwk] }, sign };
}
const base = { discovery: doc, clientId: "client-1", nonce: "n-1", managedDomains: ["example.com"] };

describe("tenant OIDC", () => {
  it("discovery must be HTTPS and name exactly the configured issuer", async () => {
    expect(await discover(ISSUER, async (url) => { expect(url).toBe(`${ISSUER}/.well-known/openid-configuration`); return json(doc); })).toEqual(doc);
    await expect(discover("http://login.example-idp.com", async () => json(doc))).rejects.toThrow("sso.discovery_invalid");
    await expect(discover(ISSUER, async () => json({ ...doc, issuer: "https://evil.example" }))).rejects.toThrow("sso.discovery_invalid");
    await expect(discover(ISSUER, async () => json({ ...doc, token_endpoint: "http://plain.example/token" }))).rejects.toThrow("sso.discovery_invalid");
    await expect(discover(ISSUER, async () => json({}, 500))).rejects.toThrow("sso.discovery_unavailable");
  });

  it("builds a PKCE S256 request with fresh state and nonce", () => {
    const r = authorizationRequest(doc, "client-1", "https://visionxixlabs.com/api/sso/oidc/callback", "alex@example.com");
    const u = new URL(r.url);
    expect(u.origin + u.pathname).toBe(doc.authorization_endpoint);
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ response_type: "code", client_id: "client-1", code_challenge_method: "S256", state: r.state, nonce: r.nonce, login_hint: "alex@example.com", scope: "openid email profile" });
    expect(u.searchParams.get("code_challenge")).not.toBe(r.codeVerifier);
    expect(authorizationRequest(doc, "c", "https://x.io/cb", "a@b.io").state).not.toBe(r.state);
    expect(stateKey(r.state)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("exchanges the code with the verifier and returns the ID token", async () => {
    const token = await exchangeCode(doc, { code: "c-1", codeVerifier: "v-1", clientId: "client-1", clientSecret: "s", redirectUri: "https://x.io/cb" }, async (url, init) => {
      expect(url).toBe(doc.token_endpoint);
      const body = new URLSearchParams(String(init?.body));
      expect(Object.fromEntries(body)).toMatchObject({ grant_type: "authorization_code", code: "c-1", code_verifier: "v-1", client_id: "client-1" });
      return json({ id_token: "abc", access_token: "x" });
    });
    expect(token).toBe("abc");
    await expect(exchangeCode(doc, { code: "c", codeVerifier: "v", clientId: "c", clientSecret: "s", redirectUri: "https://x.io/cb" }, async () => json({ error: "invalid_grant" }, 400))).rejects.toThrow("sso.token_exchange_failed");
    await expect(exchangeCode(doc, { code: "c", codeVerifier: "v", clientId: "c", clientSecret: "s", redirectUri: "https://x.io/cb" }, async () => json({ access_token: "x" }))).rejects.toThrow("sso.id_token_missing");
  });

  it("accepts a correctly signed token with the right nonce and a managed-domain email", async () => {
    const { jwks, sign } = await keys();
    const id = await verifyIdToken(await sign({ sub: "u-1", nonce: "n-1", email: "Alex@Example.com" }), { ...base, jwks });
    expect(id).toMatchObject({ subject: "u-1", email: "alex@example.com" });
    const entra = await verifyIdToken(await sign({ sub: "u-2", nonce: "n-1", preferred_username: "sam@example.com" }), { ...base, jwks });
    expect(entra.email).toBe("sam@example.com");
  });

  it("refuses wrong issuer, audience, nonce, expiry, signature, unverified or foreign-domain email", async () => {
    const { jwks, sign } = await keys();
    const other = await keys();
    const ok = { sub: "u-1", nonce: "n-1", email: "alex@example.com" };
    await expect(verifyIdToken(await sign(ok, { iss: "https://evil.example" }), { ...base, jwks })).rejects.toThrow("sso.id_token_invalid");
    await expect(verifyIdToken(await sign(ok, { aud: "other-client" }), { ...base, jwks })).rejects.toThrow("sso.id_token_invalid");
    await expect(verifyIdToken(await sign(ok, { exp: "-5m" }), { ...base, jwks })).rejects.toThrow("sso.id_token_invalid");
    await expect(verifyIdToken(await other.sign(ok), { ...base, jwks })).rejects.toThrow("sso.id_token_invalid");
    await expect(verifyIdToken(await sign({ ...ok, nonce: "replayed" }), { ...base, jwks })).rejects.toThrow("sso.nonce_mismatch");
    await expect(verifyIdToken(await sign({ ...ok, email_verified: false }), { ...base, jwks })).rejects.toThrow("sso.email_unverified");
    await expect(verifyIdToken(await sign({ ...ok, email: "alex@other.com" }), { ...base, jwks })).rejects.toThrow("sso.email_domain_mismatch");
    await expect(verifyIdToken(await sign({ sub: "u-1", nonce: "n-1" }), { ...base, jwks })).rejects.toThrow("sso.email_missing");
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(JSON.stringify({ ...ok, iss: ISSUER, aud: "client-1" })).toString("base64url")}.`;
    await expect(verifyIdToken(unsigned, { ...base, jwks })).rejects.toThrow("sso.id_token_invalid");
  });
});
