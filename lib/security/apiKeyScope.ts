/**
 * API-key scope kernel — Phase 394.
 *
 * Closed-union ApiKeyScope so the v1 surface can enforce "this key
 * can read evals but can't trigger pipeline runs" with compile-time
 * guarantees against typos.
 *
 * Scope grammar
 *   <resource>:<verb>
 *
 *   resource: pipeline | eval | release_gate | webhook
 *   verb:     read | write | trigger | admin
 *
 * Wildcards (closed-union — explicitly listed, not parsed):
 *   "*"          — full access to every resource + verb
 *   "<r>:*"      — every verb on a single resource
 *
 * `assertScope` is the only place that interprets wildcards, so a
 * future scope addition can't accidentally widen an existing key.
 *
 * Pure / deterministic.
 */

export type ApiKeyScope =
  // Pipelines
  | "pipeline:read"
  | "pipeline:trigger"
  | "pipeline:*"
  // Evals
  | "eval:read"
  | "eval:write"
  | "eval:*"
  // Release gate (read-only — gates aren't user-controllable)
  | "release_gate:read"
  | "release_gate:*"
  // Webhooks
  | "webhook:read"
  | "webhook:write"
  | "webhook:admin"
  | "webhook:*"
  // Catch-all (Enterprise only — admin route must verify before granting)
  | "*";

export type RequiredScope = Exclude<ApiKeyScope, "*" | `${string}:*`>;

const VALID_SCOPES: ReadonlySet<string> = new Set<ApiKeyScope>([
  "pipeline:read", "pipeline:trigger", "pipeline:*",
  "eval:read", "eval:write", "eval:*",
  "release_gate:read", "release_gate:*",
  "webhook:read", "webhook:write", "webhook:admin", "webhook:*",
  "*",
]);

/**
 * Returns true iff `s` is a syntactically-valid known scope. Use this
 * at mint time to reject unknown scope strings BEFORE they hit the DB —
 * once stored, a typo'd scope would be a permanent denial bug.
 */
export function isValidScope(s: string): s is ApiKeyScope {
  return VALID_SCOPES.has(s);
}

/**
 * Filter + narrow an unknown array of strings to a typed array of
 * known scopes. Unknown entries are dropped, so the caller can use
 * the return value as the canonical scopes-to-persist list.
 */
export function normalizeScopes(input: ReadonlyArray<unknown>): ApiKeyScope[] {
  const out: ApiKeyScope[] = [];
  const seen = new Set<ApiKeyScope>();
  for (const s of input) {
    if (typeof s === "string" && isValidScope(s) && !seen.has(s)) {
      out.push(s);
      seen.add(s);
    }
  }
  return out;
}

/**
 * Check whether `granted` includes the authority implied by `required`.
 *
 * Matches in priority order:
 *   1. "*"                  — universal admin
 *   2. exact match
 *   3. "<resource>:*"       — wildcard verb on the same resource
 *
 * Returns:
 *   - { allowed: true }
 *   - { allowed: false, reason: "missing_scope", required }
 *
 * Used at every public-route entrypoint so the closed-union catches
 * typos at the call site.
 */
export interface ScopeAssertion {
  allowed: boolean;
  reason?: "missing_scope";
  required?: RequiredScope;
}

export function assertScope(
  required: RequiredScope,
  granted: ReadonlyArray<ApiKeyScope>,
): ScopeAssertion {
  if (granted.includes("*")) return { allowed: true };
  if (granted.includes(required)) return { allowed: true };

  // `pipeline:read` is covered by `pipeline:*`. Extract resource part.
  const sep = required.indexOf(":");
  if (sep > 0) {
    const wildcard = `${required.slice(0, sep)}:*` as ApiKeyScope;
    if (granted.includes(wildcard)) return { allowed: true };
  }

  return { allowed: false, reason: "missing_scope", required };
}
