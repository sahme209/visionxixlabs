import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.STARTER_TOKEN_SECRET || "";
const SEP = ".";
const EXPIRY_DAYS = 7;

/**
 * Create signed token for lead access.
 * Format: base64url(leadId).timestamp.signature
 * Expires in 7 days.
 */
export function createStarterToken(leadId: string): string {
  if (!SECRET) throw new Error("STARTER_TOKEN_SECRET is required");
  const payload = Buffer.from(leadId, "utf8").toString("base64url");
  const timestamp = Math.floor(Date.now() / 1000).toString(36);
  const toSign = `${payload}${SEP}${timestamp}`;
  const sig = createHmac("sha256", SECRET).update(toSign).digest("base64url");
  return `${toSign}${SEP}${sig}`;
}

export type VerifyResult = { leadId: string } | { error: "invalid" | "expired" };

/**
 * Verify token and return leadId if valid.
 * Returns { error: "expired" } if token is older than 7 days.
 */
export function verifyStarterToken(token: string): VerifyResult {
  if (!SECRET || !token) return { error: "invalid" };
  const parts = token.split(SEP);

  // Legacy format: base64url(leadId).base64url(hmac)
  if (parts.length === 2) {
    const [leadEncoded, sigEncoded] = parts;
    try {
      const leadBuf = Buffer.from(leadEncoded, "base64url");
      const leadId = leadBuf.toString("utf8");
      const expectedHmac = createHmac("sha256", SECRET).update(leadId).digest();
      const providedBuf = Buffer.from(sigEncoded, "base64url");

      if (
        expectedHmac.length !== providedBuf.length ||
        !timingSafeEqual(expectedHmac, providedBuf)
      ) {
        return { error: "invalid" };
      }

      // Legacy tokens had no explicit expiry; accept as-is for backward compatibility.
      return { leadId };
    } catch {
      return { error: "invalid" };
    }
  }

  // Current format: base64url(leadId).timestamp.signature
  if (parts.length < 3) return { error: "invalid" };
  const sig = parts.pop()!;
  const timestamp = parts.pop()!;
  const payload = parts.join(SEP);
  const toSign = `${payload}${SEP}${timestamp}`;
  const expected = createHmac("sha256", SECRET).update(toSign).digest("base64url");
  const sigBuf = Buffer.from(sig, "base64url");
  const expectedBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { error: "invalid" };
  }
  const ts = parseInt(timestamp, 36);
  if (Number.isNaN(ts) || ts < 0) return { error: "invalid" };
  const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - ts * 1000 > expiryMs) return { error: "expired" };
  try {
    const leadId = Buffer.from(payload, "base64url").toString("utf8");
    return { leadId };
  } catch {
    return { error: "invalid" };
  }
}

