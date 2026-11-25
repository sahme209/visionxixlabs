/**
 * Pure check for the root entry redirect: the same canonical identity the
 * NextAuth jwt/session callbacks in lib/auth.ts require (identityVersion 1,
 * non-empty id and email). Anything else is treated as signed out.
 */
export function isSignedInHomeToken(token: unknown): boolean {
  if (!token || typeof token !== "object") return false;
  const value = token as { identityVersion?: unknown; id?: unknown; email?: unknown };
  return value.identityVersion === 1
    && typeof value.id === "string" && value.id.trim() !== ""
    && typeof value.email === "string" && value.email.trim() !== "";
}
