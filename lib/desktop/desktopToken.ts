/**
 * Desktop session token — mint + verify primitives.
 *
 * Tokens are opaque to the desktop client. Internally they are
 * `axm.desk.<sessionId>.<HMAC-SHA256(sessionId, secret)>`. The token has
 * no expiry of its own — the session record holds the TTL — so verifying
 * a token requires looking up the session via `desktopSession.getSession`.
 *
 * The signing secret is sourced from `DESKTOP_SESSION_SIGNING_KEY` and
 * falls back to `NEXTAUTH_SECRET` so a deployment doesn't break before
 * the dedicated key is set.
 *
 * Server-only: this module imports `node:crypto`. Never import from a
 * client component.
 */

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

const TOKEN_PREFIX = "axm.desk.";
const MIN_KEY_BYTES = 32;

function resolveSigningKey(): Buffer {
  const explicit = process.env.DESKTOP_SESSION_SIGNING_KEY?.trim();
  const fallback = process.env.NEXTAUTH_SECRET?.trim();
  const value = explicit || fallback;
  if (!value || value.length < MIN_KEY_BYTES) {
    throw AxiomErrors.internal(
      "desktop.token.no_key",
      "Desktop session signing requires DESKTOP_SESSION_SIGNING_KEY (≥ 32 chars).",
    );
  }
  return Buffer.from(value, "utf8");
}

function sign(sessionId: string, key: Buffer): string {
  return createHmac("sha256", key).update(sessionId).digest("hex");
}

export interface TokenComponents {
  sessionId: string;
  signature: string;
}

export function mintDesktopToken(sessionId: string): string {
  if (!sessionId) {
    throw AxiomErrors.validation("desktop.token.no_session", "Cannot mint token without sessionId.");
  }
  const sig = sign(sessionId, resolveSigningKey());
  return `${TOKEN_PREFIX}${sessionId}.${sig}`;
}

/**
 * Parse and HMAC-verify a token. Returns the sessionId on success. Does
 * NOT check session existence / expiry / revocation — callers must
 * follow up with `desktopSession.getSession`.
 */
export function verifyDesktopToken(token: string): TokenComponents {
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    throw AxiomErrors.validation("desktop.token.bad_prefix", "Invalid desktop token.");
  }
  const body = token.slice(TOKEN_PREFIX.length);
  const dot = body.lastIndexOf(".");
  if (dot <= 0) {
    throw AxiomErrors.validation("desktop.token.malformed", "Desktop token is malformed.");
  }
  const sessionId = body.slice(0, dot);
  const signature = body.slice(dot + 1);
  const expected = sign(sessionId, resolveSigningKey());
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw AxiomErrors.validation("desktop.token.bad_signature", "Desktop token signature does not match.");
  }
  return { sessionId, signature };
}

/** Extract the bearer token from an Authorization header. */
export function bearerFromHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  return trimmed.slice(7).trim() || null;
}
