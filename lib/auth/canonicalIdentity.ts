/** Per-object provenance, never an email-keyed cross-request identity cache. */
const canonical = new WeakMap<object, { id: string; email: string; provider: string; subject?: string }>();
export function attestCanonicalIdentity(user: { id: string; email?: string | null }, identity: { id: string; email: string }, provider: string, subject?: string): void {
  user.id = identity.id;
  user.email = identity.email;
  canonical.set(user, { ...identity, provider, subject });
}
export function canonicalIdentity(user: object, provider: string, subject?: string) {
  const resolved = canonical.get(user);
  return resolved?.provider === provider && resolved.subject === subject ? resolved : null;
}
