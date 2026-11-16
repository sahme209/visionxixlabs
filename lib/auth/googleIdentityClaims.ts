export const GOOGLE_ISSUER = "https://accounts.google.com";
export type QualifiedGoogleIdentity = { issuer: typeof GOOGLE_ISSUER; subject: string; email: string; authoritativeEmail: boolean; expiresAt: Date };
/** Input must come only from NextAuth's verified idToken:true OAuth callback. */
export function qualifiedGoogleIdentity(profile: unknown, providerAccountId: unknown, mappedEmail: unknown, now = new Date()): QualifiedGoogleIdentity | null {
  if (!profile || typeof profile !== "object") return null;
  const p = profile as Record<string, unknown>;
  if (p.iss !== GOOGLE_ISSUER && p.iss !== "accounts.google.com") return null;
  if (typeof p.sub !== "string" || !/^[\x21-\x7e]{1,255}$/.test(p.sub) || p.sub !== providerAccountId || p.email_verified !== true) return null;
  if (typeof p.email !== "string" || typeof mappedEmail !== "string") return null;
  const email = p.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email !== mappedEmail.trim().toLowerCase()) return null;
  if (typeof p.exp !== "number" || !Number.isSafeInteger(p.exp) || p.exp * 1000 <= now.getTime()) return null;
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return { issuer: GOOGLE_ISSUER, subject: p.sub, email,
    authoritativeEmail: domain === "gmail.com" || (typeof p.hd === "string" && p.hd.toLowerCase() === domain),
    expiresAt: new Date(Math.min(now.getTime() + 15 * 60_000, p.exp * 1000)) };
}
