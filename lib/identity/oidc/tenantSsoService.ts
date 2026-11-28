/**
 * Company sign-in orchestration over tenantOidc.ts. Three steps, each fail-closed:
 *  1. start: route the email's domain to exactly one OIDC provider, store an attempt (state hash,
 *     encrypted nonce + PKCE verifier, 10 minutes) and return the IdP redirect.
 *  2. callback: consume the attempt exactly once, exchange the code, verify the ID token, then
 *     - test mode (an admin checking a pending connection): record lastTestAssertionAt, sign no one in;
 *     - sign-in mode: apply the role mapping and MFA rule (ssoSignInGate), refuse anyone SCIM
 *       deprovisioned, require existing accounts to already belong to this workspace, claim the seat,
 *       and issue a one-time ticket (hash stored, 2 minutes).
 *  3. redeem: the NextAuth "sso-ticket" provider exchanges the ticket once for a normal session, so
 *     sessions are only ever minted by NextAuth.
 * Only active providers whose every managed domain was DNS-verified can sign people in.
 */
import { createHash, randomBytes } from "node:crypto";
import { authorizationRequest, discover, exchangeCode, OidcError, stateKey, verifyIdToken, type OidcDiscovery } from "./tenantOidc";
import { evaluateSsoSignIn, type SsoSignInRepo } from "../ssoSignInGate";
import { ALL_ORG_ROLES } from "../identityProviderResponder";

export const ATTEMPT_TTL_MS = 10 * 60_000;
export const TICKET_TTL_MS = 2 * 60_000;
export const PUBLIC_EMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "yandex.com", "mail.com"]);

export interface ProviderRow {
  id: string; organizationId: string; protocol: string; status: string; issuerOrEntityId: string; managedDomains: string[]; verifiedDomains: string[];
  roleMappingJson: unknown; requireMfaClaim: boolean; oidcClientId: string | null; encryptedClientSecret: string | null;
}
export interface AttemptRow {
  id: string; providerId: string; organizationId: string; mode: string; encryptedSecrets: string; callbackUrl: string; expiresAt: Date; consumedAt: Date | null;
  ticketHash: string | null; userId: string | null; ticketExpiresAt: Date | null; ticketConsumedAt: Date | null;
}
export interface SsoDeps {
  db: SsoSignInRepo & {
    tenantIdentityProvider: SsoSignInRepo["tenantIdentityProvider"] & {
      findMany(args: { where: Record<string, unknown> }): Promise<ProviderRow[]>;
      findFirst(args: { where: Record<string, unknown> }): Promise<ProviderRow | null>;
      update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    };
    ssoLoginAttempt: {
      create(args: { data: Record<string, unknown> }): Promise<unknown>;
      findUnique(args: { where: { id: string } | { ticketHash: string } }): Promise<AttemptRow | null>;
      updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
    };
    scimProvisionedIdentity: { findFirst(args: { where: Record<string, unknown>; select: { id: true } }): Promise<{ id: string } | null> };
    user: {
      findUnique(args: { where: { email: string } | { id: string }; select: Record<string, true> }): Promise<{ id: string; email: string; name?: string | null; image?: string | null } | null>;
      create(args: { data: { email: string; name: string | null; emailVerifiedAt: Date }; select: { id: true; email: true } }): Promise<{ id: string; email: string }>;
    };
    orgMembership: { findUnique(args: { where: { userId_organizationId: { userId: string; organizationId: string } }; select: { id: true } }): Promise<{ id: string } | null> };
  };
  encrypt(plain: string, context: string): string;
  decrypt(cipher: string, context: string): string;
  claimSeat(input: { organizationId: string; userId: string; role: string }): Promise<{ ok: boolean; error?: string }>;
  denied(input: { email: string; reason: string }): Promise<void>;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  jwks?: Parameters<typeof verifyIdToken>[1]["jwks"];
  now?: () => Date;
  random?: (n: number) => Buffer;
}

export type StartResult = { ok: true; redirectUrl: string } | { ok: false; reason: string };
export type CallbackResult = { ok: true; kind: "ticket"; ticket: string; callbackUrl: string } | { ok: true; kind: "test_passed"; providerId: string } | { ok: false; reason: string };

const secretContext = (providerId: string) => `tenant-idp-client-secret:${providerId}`;
const attemptContext = (id: string) => `sso-attempt:${id}`;
export const ticketHash = (ticket: string) => createHash("sha256").update(`v19-sso-ticket:${ticket}`).digest("hex");
const EMAIL = /^[^\s@]{1,64}@([a-z0-9-]+\.)+[a-z]{2,63}$/;

/** Only same-site paths; anything else returns to the default. */
export function safeCallback(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && value.length <= 512 ? value : "/control";
}

/** Usable for sign-in: active, OIDC, configured, and every managed domain DNS-verified. */
export function signInReady(p: ProviderRow): boolean {
  return p.status === "active" && p.protocol === "oidc" && !!p.oidcClientId && !!p.encryptedClientSecret && p.managedDomains.length > 0
    && p.managedDomains.every((d) => p.verifiedDomains.includes(d) && !PUBLIC_EMAIL_DOMAINS.has(d));
}

export async function startSignIn(deps: SsoDeps, input: { email: unknown; callbackUrl: unknown; redirectUri: string; mode: "signin" | "test"; testProviderId?: string; testOrganizationId?: string }): Promise<StartResult> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) return { ok: false, reason: "sso.email_invalid" };
  const domain = email.split("@")[1];
  let provider: ProviderRow | null;
  if (input.mode === "test") {
    provider = await deps.db.tenantIdentityProvider.findFirst({ where: { id: input.testProviderId, organizationId: input.testOrganizationId, protocol: "oidc", status: { in: ["pending", "active", "needs_attention"] } } });
    if (!provider || !provider.managedDomains.includes(domain)) return { ok: false, reason: "sso.no_provider_for_domain" };
  } else {
    const rows = (await deps.db.tenantIdentityProvider.findMany({ where: { status: "active", protocol: "oidc", managedDomains: { has: domain } } })).filter(signInReady);
    if (rows.length !== 1) return { ok: false, reason: rows.length ? "sso.ambiguous_provider" : "sso.no_provider_for_domain" };
    provider = rows[0];
  }
  if (!provider.oidcClientId || !provider.encryptedClientSecret) return { ok: false, reason: "sso.provider_incomplete" };
  let d: OidcDiscovery;
  try { d = await discover(provider.issuerOrEntityId, deps.fetch); } catch (e) { return { ok: false, reason: e instanceof OidcError ? e.code : "sso.discovery_unavailable" }; }
  const req = authorizationRequest(d, provider.oidcClientId, input.redirectUri, email, deps.random);
  const id = stateKey(req.state), now = deps.now?.() ?? new Date();
  await deps.db.ssoLoginAttempt.create({
    data: {
      id, providerId: provider.id, organizationId: provider.organizationId, mode: input.mode, callbackUrl: safeCallback(input.callbackUrl),
      encryptedSecrets: deps.encrypt(JSON.stringify({ nonce: req.nonce, codeVerifier: req.codeVerifier, email }), attemptContext(id)),
      expiresAt: new Date(now.getTime() + ATTEMPT_TTL_MS),
    },
  });
  return { ok: true, redirectUrl: req.url };
}

export async function completeCallback(deps: SsoDeps, input: { state: unknown; code: unknown; error: unknown; redirectUri: string }): Promise<CallbackResult> {
  if (typeof input.state !== "string" || input.state.length < 20 || input.state.length > 200) return { ok: false, reason: "sso.state_invalid" };
  const id = stateKey(input.state), now = deps.now?.() ?? new Date();
  const attempt = await deps.db.ssoLoginAttempt.findUnique({ where: { id } });
  if (!attempt) return { ok: false, reason: "sso.state_invalid" };
  // Exactly-once: a replayed or late callback loses this race and changes nothing.
  const won = await deps.db.ssoLoginAttempt.updateMany({ where: { id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
  if (won.count !== 1) return { ok: false, reason: "sso.state_expired_or_used" };
  if (typeof input.error === "string" && input.error) return { ok: false, reason: "sso.idp_refused" };
  let secrets: { nonce: string; codeVerifier: string; email: string };
  try { secrets = JSON.parse(deps.decrypt(attempt.encryptedSecrets, attemptContext(id))); } catch { return { ok: false, reason: "sso.state_invalid" }; }
  const provider = await deps.db.tenantIdentityProvider.findFirst({ where: { id: attempt.providerId, organizationId: attempt.organizationId } });
  const usable = provider && (attempt.mode === "test" ? ["pending", "active", "needs_attention"].includes(provider.status) && provider.protocol === "oidc" : signInReady(provider));
  if (!provider || !usable || !provider.oidcClientId || !provider.encryptedClientSecret) return { ok: false, reason: "sso.provider_unavailable" };
  let identity;
  try {
    const d = await discover(provider.issuerOrEntityId, deps.fetch);
    const clientSecret = deps.decrypt(provider.encryptedClientSecret, secretContext(provider.id));
    const idToken = await exchangeCode(d, { code: String(input.code ?? ""), codeVerifier: secrets.codeVerifier, clientId: provider.oidcClientId, clientSecret, redirectUri: input.redirectUri }, deps.fetch);
    identity = await verifyIdToken(idToken, { discovery: d, clientId: provider.oidcClientId, nonce: secrets.nonce, managedDomains: provider.managedDomains, jwks: deps.jwks });
  } catch (e) {
    const reason = e instanceof OidcError ? e.code : "sso.token_exchange_failed";
    await deps.denied({ email: secrets.email, reason });
    return { ok: false, reason };
  }
  if (attempt.mode === "test") {
    await deps.db.tenantIdentityProvider.update({ where: { id: provider.id }, data: { lastTestAssertionAt: now } });
    return { ok: true, kind: "test_passed", providerId: provider.id };
  }
  const deny = async (reason: string): Promise<CallbackResult> => { await deps.denied({ email: identity.email, reason }); return { ok: false, reason }; };
  const gate = await evaluateSsoSignIn(deps.db, { email: identity.email, claims: identity.claims as Record<string, unknown> });
  if (gate.kind === "denied") return deny(gate.reason);
  if (gate.organizationId !== provider.organizationId) return deny("sso.issuer_mismatch");
  if (!(ALL_ORG_ROLES as readonly string[]).includes(gate.role) || gate.role === "owner") return deny("sso.role_mapping_invalid");
  if (await deps.db.scimProvisionedIdentity.findFirst({ where: { organizationId: provider.organizationId, email: identity.email, scimActive: false }, select: { id: true } })) return deny("sso.scim_deprovisioned");
  let user = await deps.db.user.findUnique({ where: { email: identity.email }, select: { id: true, email: true } });
  if (user) {
    // An existing account is only signed in if it already belongs to this workspace, so a company's
    // identity provider can never take over an account it does not already manage.
    const member = await deps.db.orgMembership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: provider.organizationId } }, select: { id: true } });
    if (!member) return deny("sso.existing_account_not_member");
  } else {
    const name = typeof identity.claims.name === "string" ? identity.claims.name.slice(0, 120) : null;
    user = await deps.db.user.create({ data: { email: identity.email, name, emailVerifiedAt: now }, select: { id: true, email: true } });
  }
  const seat = await deps.claimSeat({ organizationId: provider.organizationId, userId: user.id, role: gate.role });
  if (!seat.ok) return deny(`sso.${seat.error ?? "seat_unavailable"}`);
  const ticket = (deps.random ?? randomBytes)(32).toString("base64url");
  await deps.db.ssoLoginAttempt.updateMany({ where: { id }, data: { ticketHash: ticketHash(ticket), userId: user.id, ticketExpiresAt: new Date(now.getTime() + TICKET_TTL_MS) } });
  return { ok: true, kind: "ticket", ticket, callbackUrl: attempt.callbackUrl };
}

/** Exchanges a ticket exactly once for the signed-in user. Used only by the NextAuth "sso-ticket" provider. */
export async function redeemTicket(deps: Pick<SsoDeps, "db" | "now">, ticket: unknown): Promise<{ id: string; email: string; name: string | null; image: string | null } | null> {
  if (typeof ticket !== "string" || ticket.length < 20 || ticket.length > 100) return null;
  const hash = ticketHash(ticket), now = deps.now?.() ?? new Date();
  const row = await deps.db.ssoLoginAttempt.findUnique({ where: { ticketHash: hash } });
  if (!row?.userId) return null;
  const won = await deps.db.ssoLoginAttempt.updateMany({ where: { ticketHash: hash, ticketConsumedAt: null, ticketExpiresAt: { gt: now } }, data: { ticketConsumedAt: now } });
  if (won.count !== 1) return null;
  const user = await deps.db.user.findUnique({ where: { id: row.userId }, select: { id: true, email: true, name: true, image: true } });
  return user ? { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null } : null;
}

export { secretContext as tenantClientSecretContext };
