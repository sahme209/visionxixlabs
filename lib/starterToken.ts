import { createHmac } from "crypto";

const SECRET = process.env.STARTER_TOKEN_SECRET || "";
const SEP = ".";

/**
 * Create signed token for lead access.
 * Format: base64(leadId).hmac(base64(leadId))
 * Do NOT use raw leadId in public URLs; use token only.
 */
export function createStarterToken(leadId: string): string {
  if (!SECRET) throw new Error("STARTER_TOKEN_SECRET is required");
  const payload = Buffer.from(leadId, "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}${SEP}${sig}`;
}

/**
 * Verify token and return leadId if valid.
 */
export function verifyStarterToken(token: string): string | null {
  if (!SECRET || !token) return null;
  const idx = token.lastIndexOf(SEP);
  if (idx <= 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
