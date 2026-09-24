/**
 * Shareable engineer report links — Phase 634.
 *
 * Lets an operator generate a signed read-only URL for any AGI
 * memory entry (engineer report). The receiver opens the URL, sees
 * the narrative + risk factors + structured payload — but no auth
 * required and no workspace access leaked.
 *
 * Implementation: HMAC-signed token containing (orgId, kind, id,
 * expiresAt). The /share/[token] route validates the signature and
 * the expiry, then renders a read-only view of the row.
 *
 * Why HMAC over JWT: simpler, no external dep, sufficient for
 * read-only links where the only claim is "this URL grants read
 * access to one row until expiresAt."
 *
 * Server-only.
 */

import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export interface ShareTokenPayload {
  organizationId: string;
  targetKind: string;
  targetId: string;
  /** Unix ms epoch. */
  expiresAt: number;
  /** Random nonce so identical (kind,id) pairs produce distinct tokens. */
  nonce: string;
}

export type ShareTokenError =
  | "malformed"
  | "bad_signature"
  | "expired";

export interface ShareTokenValidation {
  ok: boolean;
  payload: ShareTokenPayload | null;
  error: ShareTokenError | null;
}

const DEFAULT_TTL_DAYS = 14;

/**
 * Read the secret used to sign share tokens. Falls back to a
 * deployment-pinned env var if SHARE_LINK_SECRET is missing —
 * matches the pattern of other dev secrets in the codebase.
 */
function getSecret(): string {
  const secret = process.env.SHARE_LINK_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("share_link_secret_missing_or_too_short");
  }
  return secret;
}

function b64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(payload).digest();
  return b64UrlEncode(mac);
}

export function createShareToken(
  organizationId: string,
  targetKind: string,
  targetId: string,
  ttlDays: number = DEFAULT_TTL_DAYS,
): string {
  const expiresAt = Date.now() + Math.max(1, Math.min(90, ttlDays)) * 24 * 60 * 60 * 1000;
  const nonce = b64UrlEncode(randomBytes(8));
  const payload: ShareTokenPayload = { organizationId, targetKind, targetId, expiresAt, nonce };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = b64UrlEncode(Buffer.from(payloadJson, "utf8"));
  const signature = sign(payloadB64, getSecret());
  return `${payloadB64}.${signature}`;
}

export function validateShareToken(token: string): ShareTokenValidation {
  if (typeof token !== "string" || token.length === 0 || !token.includes(".")) {
    return { ok: false, payload: null, error: "malformed" };
  }
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return { ok: false, payload: null, error: "malformed" };
  }
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    // Surface the misconfig honestly; treat as bad_signature so
    // valid tokens can't accidentally validate against a missing key.
    return { ok: false, payload: null, error: "bad_signature" };
  }
  const expected = sign(payloadB64, secret);
  // Length-pad both buffers so timingSafeEqual doesn't throw on
  // mismatched lengths.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, payload: null, error: "bad_signature" };
  }
  let payload: ShareTokenPayload;
  try {
    payload = JSON.parse(b64UrlDecode(payloadB64).toString("utf8")) as ShareTokenPayload;
  } catch {
    return { ok: false, payload: null, error: "malformed" };
  }
  if (
    typeof payload.organizationId !== "string" ||
    typeof payload.targetKind !== "string" ||
    typeof payload.targetId !== "string" ||
    typeof payload.expiresAt !== "number"
  ) {
    return { ok: false, payload: null, error: "malformed" };
  }
  if (Date.now() > payload.expiresAt) {
    return { ok: false, payload: null, error: "expired" };
  }
  return { ok: true, payload, error: null };
}
