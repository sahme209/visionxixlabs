/**
 * DEPRECATED: Use lib/starterToken.ts for all new lead-scoped token flows. This helper will be phased out.
 *
 * Signed token for secure starter package access.
 * Token = base64url(leadId).base64url(hmac)
 * Env: STARTER_TOKEN_SECRET (required for token operations)
 */

import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret = process.env.STARTER_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("STARTER_TOKEN_SECRET must be set and at least 16 characters");
  }
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

export function createStarterToken(leadId: string): string {
  const secret = getSecret();
  const hmac = createHmac("sha256", secret).update(leadId).digest();
  const leadIdEncoded = base64UrlEncode(Buffer.from(leadId, "utf-8"));
  const sigEncoded = base64UrlEncode(hmac);
  return `${leadIdEncoded}.${sigEncoded}`;
}

export function verifyStarterToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  try {
    const secret = getSecret();
    const leadIdBuf = base64UrlDecode(parts[0]);
    const leadId = leadIdBuf.toString("utf-8");
    const expectedHmac = createHmac("sha256", secret).update(leadId).digest();
    const providedSig = base64UrlDecode(parts[1]);

    if (expectedHmac.length !== providedSig.length || !timingSafeEqual(expectedHmac, providedSig)) {
      return null;
    }
    return leadId;
  } catch {
    return null;
  }
}
