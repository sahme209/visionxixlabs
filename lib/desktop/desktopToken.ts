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

import { AxiomErrors } from "@/lib/errors/axiomErrors";

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

export { createPrivateDesktopTokenCodec } from "./privateDesktopToken";
export type { TokenComponents } from "./privateDesktopToken";
import { createDesktopTokenCodecWithKeyResolver } from "./privateDesktopToken";
export function mintDesktopToken(sessionId: string): string {
 return createDesktopTokenCodecWithKeyResolver(resolveSigningKey).mintDesktopToken(sessionId);
}
export function verifyDesktopToken(token: string) {
 return createDesktopTokenCodecWithKeyResolver(resolveSigningKey).verifyDesktopToken(token);
}

/** Extract the bearer token from an Authorization header. */
export function bearerFromHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  return trimmed.slice(7).trim() || null;
}
