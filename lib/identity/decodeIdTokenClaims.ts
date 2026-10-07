/**
 * Decodes an OIDC ID token's claims without re-verifying the signature.
 * Safe only because the caller (lib/auth.ts's signIn callback) only ever
 * calls this on an id_token NextAuth's own OIDC client already validated
 * during the authorization-code exchange (issuer/audience/signature) —
 * this is reading already-trusted claims, not establishing trust itself.
 * Never call this on a token from an unvalidated source.
 */

export function decodeIdTokenClaims(idToken: string): Record<string, unknown> | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const json = Buffer.from(base64, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
