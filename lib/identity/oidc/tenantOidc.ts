/**
 * Per-workspace OpenID Connect sign-in (docs/ENTERPRISE_IDENTITY_DESIGN.md, "Sign-in flow (OIDC)").
 *
 * Authorization code flow with PKCE (S256), state and nonce. The company's identity provider is
 * found by the person's email domain (TenantIdentityProvider.managedDomains); the person never
 * picks a provider, so one tenant's IdP cannot speak for another tenant's users.
 *
 * Everything that can go wrong fails closed with a fixed reason code. No token or secret is ever
 * logged or returned. Network access is only to the configured issuer's own discovery document,
 * token endpoint and JWKS, all over HTTPS.
 */
import { createHash, randomBytes } from "node:crypto";
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JSONWebKeySet, type JWTPayload } from "jose";

export interface OidcDiscovery { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }
export type OidcFailure =
  | "sso.discovery_unavailable" | "sso.discovery_invalid" | "sso.token_exchange_failed" | "sso.id_token_missing"
  | "sso.id_token_invalid" | "sso.nonce_mismatch" | "sso.email_missing" | "sso.email_unverified" | "sso.email_domain_mismatch";
export class OidcError extends Error { constructor(readonly code: OidcFailure) { super(code); } }

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
const TIMEOUT_MS = 8000;
const MAX_BODY = 256 * 1024;

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null; } catch { return null; }
}

/** Normalizes an issuer for comparison (a trailing slash is not significant). */
export const sameIssuer = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.length > MAX_BODY) throw new Error("too_large");
  return JSON.parse(text);
}

/** Fetches and checks the issuer's discovery document. The document must name exactly the configured issuer. */
export async function discover(issuer: string, fetchImpl: FetchLike = fetch): Promise<OidcDiscovery> {
  const base = httpsUrl(issuer);
  if (!base) throw new OidcError("sso.discovery_invalid");
  let doc: Record<string, unknown>;
  try {
    const res = await fetchImpl(`${base.replace(/\/+$/, "")}/.well-known/openid-configuration`, { redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    doc = (await readJson(res)) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof OidcError) throw e;
    throw new OidcError("sso.discovery_unavailable");
  }
  const out = { issuer: doc?.issuer, authorization_endpoint: httpsUrl(doc?.authorization_endpoint), token_endpoint: httpsUrl(doc?.token_endpoint), jwks_uri: httpsUrl(doc?.jwks_uri) };
  if (typeof out.issuer !== "string" || !sameIssuer(out.issuer, issuer) || !out.authorization_endpoint || !out.token_endpoint || !out.jwks_uri) throw new OidcError("sso.discovery_invalid");
  return out as OidcDiscovery;
}

export interface AuthorizationRequest { url: string; state: string; nonce: string; codeVerifier: string }

const b64url = (buf: Buffer) => buf.toString("base64url");

/** Builds the authorization redirect with fresh state, nonce and PKCE verifier. */
export function authorizationRequest(d: OidcDiscovery, clientId: string, redirectUri: string, loginHint: string, random: (n: number) => Buffer = randomBytes): AuthorizationRequest {
  const state = b64url(random(32)), nonce = b64url(random(32)), codeVerifier = b64url(random(48));
  const challenge = b64url(createHash("sha256").update(codeVerifier).digest());
  const u = new URL(d.authorization_endpoint);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("nonce", nonce);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("login_hint", loginHint);
  return { url: u.toString(), state, nonce, codeVerifier };
}

/** Hash used to store and look up state values; the raw state only travels in the browser. */
export const stateKey = (state: string) => createHash("sha256").update(`v19-sso-state:${state}`).digest("hex");

/** Exchanges the code (client_secret_post, which Entra, Okta, Google Workspace and Auth0 accept). Returns the raw ID token. */
export async function exchangeCode(d: OidcDiscovery, input: { code: string; codeVerifier: string; clientId: string; clientSecret: string; redirectUri: string }, fetchImpl: FetchLike = fetch): Promise<string> {
  if (typeof input.code !== "string" || !input.code || input.code.length > 4096) throw new OidcError("sso.token_exchange_failed");
  const body = new URLSearchParams({ grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri, client_id: input.clientId, client_secret: input.clientSecret, code_verifier: input.codeVerifier });
  let json: Record<string, unknown>;
  try {
    const res = await fetchImpl(d.token_endpoint, { method: "POST", body, redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    json = (await readJson(res)) as Record<string, unknown>;
  } catch {
    throw new OidcError("sso.token_exchange_failed");
  }
  if (typeof json?.id_token !== "string" || !json.id_token) throw new OidcError("sso.id_token_missing");
  return json.id_token;
}

export interface VerifiedIdentity { subject: string; email: string; claims: JWTPayload }

/**
 * Verifies the ID token's signature (issuer JWKS), issuer, audience, expiry and nonce, and requires a
 * verified email in one of the provider's managed domains.
 */
export async function verifyIdToken(
  idToken: string,
  input: { discovery: OidcDiscovery; clientId: string; nonce: string; managedDomains: readonly string[]; jwks?: JSONWebKeySet; now?: Date },
): Promise<VerifiedIdentity> {
  let payload: JWTPayload;
  try {
    const keys = input.jwks ? createLocalJWKSet(input.jwks) : createRemoteJWKSet(new URL(input.discovery.jwks_uri), { timeoutDuration: TIMEOUT_MS });
    ({ payload } = await jwtVerify(idToken, keys, {
      issuer: input.discovery.issuer, audience: input.clientId, clockTolerance: 60, maxTokenAge: "10m",
      algorithms: ["RS256", "RS384", "RS512", "PS256", "ES256", "ES384", "EdDSA"],
      ...(input.now ? { currentDate: input.now } : {}),
    }));
  } catch {
    throw new OidcError("sso.id_token_invalid");
  }
  if (typeof payload.nonce !== "string" || payload.nonce !== input.nonce) throw new OidcError("sso.nonce_mismatch");
  if (typeof payload.sub !== "string" || !payload.sub) throw new OidcError("sso.id_token_invalid");
  // Entra puts the address in email or preferred_username; only a verified or tenant-asserted address counts.
  const raw = typeof payload.email === "string" ? payload.email : typeof payload.preferred_username === "string" && payload.preferred_username.includes("@") ? payload.preferred_username : null;
  if (!raw) throw new OidcError("sso.email_missing");
  if (payload.email_verified === false) throw new OidcError("sso.email_unverified");
  const email = raw.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  if (!input.managedDomains.some((d) => d.toLowerCase() === domain)) throw new OidcError("sso.email_domain_mismatch");
  return { subject: payload.sub, email, claims: payload };
}
