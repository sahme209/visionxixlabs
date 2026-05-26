/**
 * LinkedIn OAuth 2.0 — internal admin connect flow.
 *
 * Only used by /api/admin/growth/linkedin/{connect,callback}. Builds the
 * authorize URL and exchanges the code for an access token using the
 * official LinkedIn endpoints. NO scraping, no cookie hacks.
 *
 * Required env (any-missing → `isLinkedInConfigured` returns false):
 *   - LINKEDIN_CLIENT_ID
 *   - LINKEDIN_CLIENT_SECRET
 *   - LINKEDIN_REDIRECT_URI  (must exactly match the value registered
 *                             on the LinkedIn developer app)
 * Optional:
 *   - LINKEDIN_ORGANIZATION_ID  (numeric — only when posting to a page)
 *   - LINKEDIN_OAUTH_SCOPES     (comma-joined; default below)
 *
 * Default scopes target the modern "Share on LinkedIn" + "Sign In with
 * LinkedIn using OpenID Connect" products. If your LinkedIn app only
 * has Marketing Developer Platform approval, override via env.
 */

import "server-only";

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

const DEFAULT_SCOPES = ["openid", "profile", "email", "w_member_social"] as const;

export interface LinkedInOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  organizationId?: string;
  scopes: readonly string[];
}

export type LinkedInConfigResult =
  | { kind: "configured"; config: LinkedInOAuthConfig }
  | { kind: "missing"; missing: readonly string[] };

export function loadLinkedInConfig(): LinkedInConfigResult {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID?.trim();
  const scopesEnv = process.env.LINKEDIN_OAUTH_SCOPES?.trim();

  const missing: string[] = [];
  if (!clientId) missing.push("LINKEDIN_CLIENT_ID");
  if (!clientSecret) missing.push("LINKEDIN_CLIENT_SECRET");
  if (!redirectUri) missing.push("LINKEDIN_REDIRECT_URI");

  if (missing.length > 0 || !clientId || !clientSecret || !redirectUri) {
    return { kind: "missing", missing };
  }

  const scopes = scopesEnv
    ? scopesEnv.split(",").map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_SCOPES];

  return {
    kind: "configured",
    config: { clientId, clientSecret, redirectUri, organizationId: orgId || undefined, scopes },
  };
}

export function isLinkedInConfigured(): boolean {
  return loadLinkedInConfig().kind === "configured";
}

export function isPostingEnabled(): boolean {
  return (process.env.LINKEDIN_POSTING_ENABLED ?? "").toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// Authorize URL — used by /api/admin/growth/linkedin/connect.
// ---------------------------------------------------------------------------

export function buildAuthorizeUrl(state: string): { kind: "ok"; url: string } | { kind: "missing"; missing: readonly string[] } {
  const cfg = loadLinkedInConfig();
  if (cfg.kind === "missing") return cfg;
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     cfg.config.clientId,
    redirect_uri:  cfg.config.redirectUri,
    state,
    scope:         cfg.config.scopes.join(" "),
  });
  return { kind: "ok", url: `${AUTHORIZE_URL}?${params.toString()}` };
}

// ---------------------------------------------------------------------------
// Token exchange — used by /api/admin/growth/linkedin/callback.
// ---------------------------------------------------------------------------

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
}

export type TokenExchangeResult =
  | { kind: "ok"; token: LinkedInTokenResponse }
  | { kind: "missing_config"; missing: readonly string[] }
  | { kind: "http_error"; status: number; body: string }
  | { kind: "network_error"; message: string };

export async function exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
  const cfg = loadLinkedInConfig();
  if (cfg.kind === "missing") return { kind: "missing_config", missing: cfg.missing };

  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    code,
    redirect_uri:  cfg.config.redirectUri,
    client_id:     cfg.config.clientId,
    client_secret: cfg.config.clientSecret,
  });

  try {
    const res = await fetch(TOKEN_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
      cache:   "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { kind: "http_error", status: res.status, body: text.slice(0, 500) };
    }
    const json = (await res.json()) as LinkedInTokenResponse;
    return { kind: "ok", token: json };
  } catch (err) {
    return { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Member info — used to grab the URN + display name after token exchange.
// ---------------------------------------------------------------------------

export interface LinkedInUserInfo {
  sub: string;          // LinkedIn member id (used to build urn:li:person:<sub>)
  name?: string;
  email?: string;
  picture?: string;
}

export type UserInfoResult =
  | { kind: "ok"; info: LinkedInUserInfo }
  | { kind: "http_error"; status: number; body: string }
  | { kind: "network_error"; message: string };

export async function fetchUserInfo(accessToken: string): Promise<UserInfoResult> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache:   "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { kind: "http_error", status: res.status, body: text.slice(0, 500) };
    }
    const json = (await res.json()) as LinkedInUserInfo;
    return { kind: "ok", info: json };
  } catch (err) {
    return { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
  }
}

export function memberUrn(memberId: string): string {
  return `urn:li:person:${memberId}`;
}
