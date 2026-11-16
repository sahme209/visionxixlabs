import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const GOOGLE_LINK_COOKIE = "__Host-axiom.google_identity_link.v1";
export const LOCAL_GOOGLE_LINK_COOKIE = "axiom.google_identity_link.local.v1";
export const googleLinkContext = new AsyncLocalStorage<{ callbackPath: string; pendingCookie?: string }>();
export function hashGoogleLinkProof(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export function newGoogleLinkNonce(): string { return randomBytes(32).toString("base64url"); }
export function googleLinkCsrf(nonce: string, intentId: string): string { return createHmac("sha256", nonce).update(`axiom.google-link.csrf.v1:${intentId}`).digest("base64url"); }
export function sameGoogleLinkHash(value: string, expected: string): boolean {
  const actual = hashGoogleLinkProof(value);
  return /^[a-f0-9]{64}$/.test(expected) && timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
export function googleLinkCookieValue(header: string | null, secure = true): string | null {
  const name = secure ? GOOGLE_LINK_COOKIE : LOCAL_GOOGLE_LINK_COOKIE;
  const entries = (header ?? "").split(";").map(p => p.trim()).filter(p => p.startsWith(`${name}=`));
  if (entries.length !== 1) return null;
  const nonce = entries[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(nonce) ? nonce : null;
}
export function googleLinkCookie(nonce: string, secure: boolean, maxAge = 900): string {
  return `${secure ? GOOGLE_LINK_COOKIE : LOCAL_GOOGLE_LINK_COOKIE}=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
