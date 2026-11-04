import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AxiomErrors } from "@/lib/errors/axiomErrors";
const TOKEN_PREFIX = "axm.desk.";
export interface TokenComponents {
  sessionId: string;
  signature: string;
}


export function createPrivateDesktopTokenCodec(signingKey: Uint8Array) {
 if (!(signingKey instanceof Uint8Array) || signingKey.byteLength < 32) throw new Error("Desktop signing key requires at least 32 bytes");
 const key = Buffer.from(signingKey);
 return createDesktopTokenCodecWithKeyResolver(() => key);
}

/** Shared legacy mechanics; private composition uses copied explicit key bytes above. */
export function createDesktopTokenCodecWithKeyResolver(resolveKey: () => Buffer) {
function sign(sessionId: string, key: Buffer): string {
  return createHmac("sha256", key).update(sessionId).digest("hex");
}

function mintDesktopToken(sessionId: string): string {
  if (!sessionId) {
    throw AxiomErrors.validation("desktop.token.no_session", "Cannot mint token without sessionId.");
  }
  const sig = sign(sessionId, resolveKey());
  return `${TOKEN_PREFIX}${sessionId}.${sig}`;
}

/**
 * Parse and HMAC-verify a token. Returns the sessionId on success. Does
 * NOT check session existence / expiry / revocation — callers must
 * follow up with `desktopSession.getSession`.
 */
function verifyDesktopToken(token: string): TokenComponents {
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
  // Buffer's hexadecimal decoder ignores trailing non-hex characters and an
  // unmatched nibble. Reject those forms before comparing signature bytes.
  if (signature.length !== 64 || !/^[a-f0-9]{64}$/i.test(signature)) {
    throw AxiomErrors.validation("desktop.token.bad_signature", "Desktop token signature is malformed.");
  }
  const expected = sign(sessionId, resolveKey());
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw AxiomErrors.validation("desktop.token.bad_signature", "Desktop token signature does not match.");
  }
  return { sessionId, signature };
}


return Object.freeze({ mintDesktopToken, verifyDesktopToken });
}
