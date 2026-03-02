/**
 * Signed access tokens for lead links.
 * Uses HMAC-SHA256 with STARTER_TOKEN_SECRET. Never expose starter/preview content by raw leadId.
 */

import { createHmac, timingSafeEqual } from "crypto";

const ALG = "sha256";
const SEP = ".";

function getSecret(): string {
  const secret = process.env.STARTER_TOKEN_SECRET;
  if (!secret?.trim()) throw new Error("STARTER_TOKEN_SECRET not set");
  return secret;
}

export function createStarterToken(leadId: string): string {
  const secret = getSecret();
  const payload = leadId;
  const sig = createHmac(ALG, secret).update(payload).digest("base64url");
  return `${payload}${SEP}${sig}`;
}

export function verifyStarterToken(token: string): string | null {
  try {
    const secret = getSecret();
    const idx = token.lastIndexOf(SEP);
    if (idx <= 0) return null;
    const payload = token.slice(0, idx);
    const sig = token.slice(idx + 1);
    const expected = createHmac(ALG, secret).update(payload).digest("base64url");
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
