/**
 * HMAC-signed access tokens for starter/preview endpoints.
 * Do NOT expose content by raw leadId; require signed token.
 * Env: STARTER_TOKEN_SECRET
 */

import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.STARTER_TOKEN_SECRET;

export function createStarterToken(leadId: string): string {
  if (!SECRET || SECRET.length < 16) {
    throw new Error("STARTER_TOKEN_SECRET must be set and at least 16 chars");
  }
  const payload = leadId;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  const raw = `${leadId}.${sig}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

export function verifyStarterToken(token: string): string | null {
  if (!SECRET || SECRET.length < 16 || !token) return null;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const dot = raw.lastIndexOf(".");
    if (dot < 1) return null;
    const leadId = raw.slice(0, dot);
    const sigGiven = raw.slice(dot + 1);
    const sigExpected = createHmac("sha256", SECRET).update(leadId).digest("hex");
    if (sigGiven.length !== sigExpected.length || !timingSafeEqual(Buffer.from(sigGiven, "hex"), Buffer.from(sigExpected, "hex"))) {
      return null;
    }
    return leadId;
  } catch {
    return null;
  }
}
