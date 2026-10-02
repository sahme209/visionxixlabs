/**
 * OAuth providers return granted scopes as a space- or comma-delimited string.
 * Treat a partial grant as unsuccessful rather than recording a connection
 * whose stated capabilities do not match the authority it actually received.
 */
export function splitGrantedScopes(value: string | undefined): string[] {
  return (value ?? "").split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean);
}

export function hasRequiredScopes(granted: readonly string[], required: readonly string[]): boolean {
  const grantedSet = new Set(granted);
  return required.every((scope) => grantedSet.has(scope));
}
