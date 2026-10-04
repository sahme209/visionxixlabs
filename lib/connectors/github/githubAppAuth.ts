/**
 * GitHub App authentication.
 *
 * Mints the two-stage credential GitHub Apps require:
 *
 *   1. **App JWT** — signed with the App's private key (RS256). Valid for
 *      10 minutes. Identifies "this is App #N" to GitHub.
 *   2. **Installation access token** — POST to
 *      /app/installations/{id}/access_tokens with the App JWT. Returns a
 *      short-lived (1 hour) bearer token scoped to one installation.
 *
 * The installation token is what the rest of the platform actually uses
 * to read repos / workflows / branch protection on behalf of the
 * installed organisation.
 *
 * This module caches each installation-token scope in-memory until ~5 minutes
 * before its real expiry, so we don't pay the JWT-sign + HTTP round-trip on
 * every API call. The cache is bounded and expired entries are discarded on
 * writes. A token narrowed to selected repositories never shares a cache entry
 * with an installation-wide token.
 *
 * Hard rules:
 *  - Never returns the private key or the JWT. Only the installation
 *    token is exposed to other modules.
 *  - Never logs key material — error messages strip BEGIN/END PRIVATE
 *    KEY blocks.
 *  - Server-only. Imports `node:crypto`.
 */

import "server-only";

import { createSign } from "node:crypto";
import { getGithubConfig, resolveGithubAppPrivateKey } from "./githubConfig";

const GITHUB_API = "https://api.github.com";
const JWT_TTL_SEC = 9 * 60;             // GitHub max is 10 min; we use 9 to allow for clock skew.
const TOKEN_REFRESH_BUFFER_MS = 5 * 60_000; // Refresh installation tokens 5 min before expiry.
const MAX_CACHED_INSTALLATION_TOKENS = 128;

// ---------------------------------------------------------------------------
// JWT signing (RS256 — GitHub requires it)
// ---------------------------------------------------------------------------

interface JwtClaims {
  iat: number;
  exp: number;
  iss: number;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signJwt(appId: number, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims: JwtClaims = {
    iat: now - 30,           // 30s clock-skew tolerance backward.
    exp: now + JWT_TTL_SEC,
    iss: appId,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

// ---------------------------------------------------------------------------
// Installation token caching
// ---------------------------------------------------------------------------

interface CachedInstallationToken {
  token: string;
  expiresAt: number;
  installationId: number;
  scopeKey: string;
}

const cachedByScope = new Map<string, CachedInstallationToken>();

function tokenIsFresh(c: CachedInstallationToken | undefined): boolean {
  if (!c) return false;
  return c.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS;
}

/**
 * A release request can name a distinct repository scope, so cache keys are
 * intentionally high-cardinality. Keep the process-local cache bounded and
 * remove tokens that are no longer valid before adding another one.
 */
function pruneInstallationTokenCache(now = Date.now()): void {
  for (const [key, cached] of cachedByScope) {
    if (cached.expiresAt - now <= TOKEN_REFRESH_BUFFER_MS) cachedByScope.delete(key);
  }
  if (cachedByScope.size < MAX_CACHED_INSTALLATION_TOKENS) return;

  let oldestKey: string | undefined;
  let oldestExpiry = Number.POSITIVE_INFINITY;
  for (const [key, cached] of cachedByScope) {
    if (cached.expiresAt < oldestExpiry) {
      oldestKey = key;
      oldestExpiry = cached.expiresAt;
    }
  }
  if (oldestKey) cachedByScope.delete(oldestKey);
}

// ---------------------------------------------------------------------------
// Public entry — resolve a usable installation token
// ---------------------------------------------------------------------------

export interface InstallationTokenResult {
  ok: true;
  token: string;
  installationId: number;
  expiresAt: number;
}

export interface InstallationTokenError {
  ok: false;
  errorCode: string;
  message: string;
}

export type InstallationTokenOutcome = InstallationTokenResult | InstallationTokenError;

const REPOSITORY_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

function normalizeRepositoryScope(repositories: readonly string[] | undefined): string[] | null {
  if (repositories === undefined) return [];
  const normalized = [...new Set(repositories.map((name) => name.trim().toLowerCase()))].sort();
  if (normalized.length === 0 || normalized.length > 500 || normalized.some((name) => !REPOSITORY_NAME.test(name))) return null;
  return normalized;
}

/**
 * Mints an installation token. Callers that already know the exact repository
 * scope must provide it, which asks GitHub for a token restricted to only
 * those repositories. Unscoped calls remain for legacy read paths and are
 * deliberately cached separately from every narrowed token.
 */
export async function resolveGithubInstallationToken(
  input: { installationId?: number; repositories?: readonly string[] } = {},
): Promise<InstallationTokenOutcome> {
  const cfg = getGithubConfig();
  if (!cfg.appConfigured || !cfg.appId) {
    return { ok: false, errorCode: "github.app_not_configured", message: "GITHUB_APP_ID + GITHUB_PRIVATE_KEY required for App auth." };
  }
  const installationId = input.installationId ?? cfg.installationId;
  if (!installationId || !Number.isSafeInteger(installationId) || installationId < 1) {
    return { ok: false, errorCode: "github.app_no_installation", message: "GITHUB_INSTALLATION_ID required to mint an installation access token." };
  }
  const repositories = normalizeRepositoryScope(input.repositories);
  if (!repositories) {
    return { ok: false, errorCode: "github.app_invalid_repository_scope", message: "Repository-scoped installation tokens require 1–500 valid repository names." };
  }
  const scopeKey = `${installationId}:${repositories.length ? repositories.join("\u0000") : "*"}`;

  const cached = cachedByScope.get(scopeKey);
  if (cached && tokenIsFresh(cached)) {
    return { ok: true, token: cached.token, installationId: cached.installationId, expiresAt: cached.expiresAt };
  }
  pruneInstallationTokenCache();

  const privateKey = resolveGithubAppPrivateKey();
  if (!privateKey) {
    return { ok: false, errorCode: "github.app_no_key", message: "GITHUB_PRIVATE_KEY not present on the host." };
  }

  let appJwt: string;
  try {
    appJwt = signJwt(cfg.appId, privateKey);
  } catch (err) {
    return {
      ok: false,
      errorCode: "github.app_jwt_sign_failed",
      message: `Could not sign App JWT: ${redact(err)}`,
    };
  }

  try {
    const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "axiom-agent/1.0",
      },
      body: repositories.length ? JSON.stringify({ repositories }) : undefined,
    });
    if (res.status === 401) {
      return { ok: false, errorCode: "github.app_jwt_rejected", message: "GitHub rejected the App JWT (401). Verify GITHUB_APP_ID + GITHUB_PRIVATE_KEY match." };
    }
    if (res.status === 404) {
      return { ok: false, errorCode: "github.app_installation_not_found", message: "Installation id not found for this App." };
    }
    if (!res.ok) {
      return { ok: false, errorCode: "github.app_token_failed", message: `GitHub returned HTTP ${res.status}.` };
    }
    const body = (await res.json().catch(() => undefined)) as { token?: string; expires_at?: string } | undefined;
    if (!body?.token || !body?.expires_at) {
      return { ok: false, errorCode: "github.app_token_malformed", message: "GitHub returned no token / expiry." };
    }
    const expiresAt = Date.parse(body.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt - Date.now() <= TOKEN_REFRESH_BUFFER_MS) {
      return { ok: false, errorCode: "github.app_token_malformed", message: "GitHub returned an invalid or near-expiry installation token." };
    }
    const nextCached: CachedInstallationToken = {
      token: body.token,
      expiresAt,
      installationId,
      scopeKey,
    };
    cachedByScope.set(scopeKey, nextCached);
    return { ok: true, token: nextCached.token, installationId: nextCached.installationId, expiresAt: nextCached.expiresAt };
  } catch (err) {
    return { ok: false, errorCode: "github.app_token_network", message: `Network error: ${redact(err)}` };
  }
}

/** Test seam — drop the cache so a subsequent call re-mints. */
export function clearInstallationTokenCache(): void {
  cachedByScope.clear();
}

/**
 * Drop every cached token scope for one installation. Call this when an
 * installation is suspended or revoked — without it, a cached token stays
 * usable for up to TOKEN_REFRESH_BUFFER_MS past the status change (GitHub
 * installation tokens live up to ~1h; the cache only refreshes 5 min before
 * expiry), so a "revoked" installation could still serve live API calls
 * for most of that window.
 */
export function purgeInstallationTokenCache(installationId: number): void {
  for (const [key, cached] of cachedByScope) {
    if (cached.installationId === installationId) cachedByScope.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function redact(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g, "-----PRIVATE KEY REDACTED-----");
}
