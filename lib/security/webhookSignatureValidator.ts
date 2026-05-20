/**
 * Pure webhook-signature validator.
 *
 * Validates HMAC-SHA256 signatures shared-secret-style (Stripe-shape,
 * GitHub-shape, or operator-defined). Timing-safe compare to avoid
 * channel attacks. Optional timestamp anti-replay window.
 *
 * Pure / deterministic. Uses node:crypto.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface ValidationInput {
  rawBody: string;
  /** Hex-encoded signature from the upstream header. */
  signatureHex: string;
  /** Shared secret. Never logged. */
  secret: string;
  /** Optional timestamp string (e.g. Stripe's t=) for anti-replay. */
  timestampSec?: number;
  /** Max acceptable skew in seconds (default 300). */
  toleranceSec?: number;
  /** "now" in seconds for tests. */
  nowSec?: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: "bad_signature" | "missing_secret" | "stale_timestamp" | "future_timestamp" | "malformed_hex";
}

const hexRe = /^[0-9a-f]+$/i;

const computeHmacHex = (secret: string, body: string): string =>
  createHmac("sha256", secret).update(body, "utf8").digest("hex");

const timingSafeEqualHex = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
};

export function validateWebhookSignature(input: ValidationInput): ValidationResult {
  if (!input.secret) return { valid: false, reason: "missing_secret" };
  if (!hexRe.test(input.signatureHex)) return { valid: false, reason: "malformed_hex" };

  if (typeof input.timestampSec === "number") {
    const now = input.nowSec ?? Math.floor(Date.now() / 1000);
    const tol = Math.max(0, input.toleranceSec ?? 300);
    if (input.timestampSec < now - tol) return { valid: false, reason: "stale_timestamp" };
    if (input.timestampSec > now + tol) return { valid: false, reason: "future_timestamp" };
  }

  // When timestamp is supplied, the canonical signed payload is "<ts>.<body>".
  const payload = typeof input.timestampSec === "number"
    ? `${input.timestampSec}.${input.rawBody}`
    : input.rawBody;

  const expected = computeHmacHex(input.secret, payload);
  if (!timingSafeEqualHex(expected, input.signatureHex)) {
    return { valid: false, reason: "bad_signature" };
  }
  return { valid: true };
}

/** Helper for callers that just need the canonical signature. */
export function signWebhookPayload(secret: string, rawBody: string, timestampSec?: number): string {
  const payload = typeof timestampSec === "number" ? `${timestampSec}.${rawBody}` : rawBody;
  return computeHmacHex(secret, payload);
}
