/**
 * Environment-scoped configuration variables (pure kernel, no I/O).
 *
 * A variable is either a workspace default or an override for one
 * environment. Values are plain configuration; anything that looks like a
 * credential is refused so secrets stay in scoped, encrypted credentials.
 */
import { createHash } from "node:crypto";

export const WORKSPACE_SCOPE = "workspace" as const;
export type VariableScope = typeof WORKSPACE_SCOPE | `env:${string}`;
import { MAX_VARIABLE_VALUE } from "./scopedVariableMessages";
export { MAX_VARIABLE_VALUE };
export const MAX_VARIABLES_PER_WORKSPACE = 500;

export interface StoredVariable { key: string; value: string; scopeKey: string; description?: string | null }
export interface ResolvedVariable { key: string; value: string; source: "workspace" | "environment" }

import type { VariableInputError } from "./scopedVariableMessages";
export type { VariableInputError } from "./scopedVariableMessages";
export { VARIABLE_ERROR_TEXT } from "./scopedVariableMessages";

const KEY = /^[A-Z][A-Z0-9_]{0,63}$/;
const SECRET_KEY_WORDS = new Set(["SECRET", "SECRETS", "TOKEN", "TOKENS", "PASSWORD", "PASSWD", "PWD", "APIKEY", "CREDENTIAL", "CREDENTIALS", "PRIVATE"]);
const SECRET_KEY_PAIRS = ["API_KEY", "ACCESS_KEY", "SIGNING_KEY", "ENCRYPTION_KEY"];
function looksLikeSecretKey(key: string): boolean {
  const words = key.split("_");
  return words.some((w) => SECRET_KEY_WORDS.has(w)) || SECRET_KEY_PAIRS.some((pair) => `_${key}_`.includes(`_${pair}_`));
}
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,          // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/, // Stripe
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,    // Slack
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
  /:\/\/[^\s/:@]+:[^\s/@]+@/,             // credentials inside a URL
];

export function scopeKeyFor(environmentId: string | null): VariableScope {
  return environmentId ? `env:${environmentId}` : WORKSPACE_SCOPE;
}

export function validateVariable(input: { key: string; value: string; scopeKey: string; description?: string | null }): VariableInputError[] {
  const errors: VariableInputError[] = [];
  if (!KEY.test(input.key)) errors.push("key_invalid");
  else if (looksLikeSecretKey(input.key)) errors.push("looks_like_secret_key");
  if (input.value.length > MAX_VARIABLE_VALUE) errors.push("value_too_long");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.value)) errors.push("value_has_control_characters");
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(input.value))) errors.push("looks_like_secret_value");
  if (input.scopeKey !== WORKSPACE_SCOPE && !/^env:[A-Za-z0-9_-]{1,64}$/.test(input.scopeKey)) errors.push("scope_invalid");
  if ((input.description ?? "").length > 500) errors.push("description_too_long");
  return errors;
}

/** Resolve the variables one environment sees: its overrides win over workspace defaults. */
export function resolveVariables(variables: readonly StoredVariable[], environmentId: string): ResolvedVariable[] {
  const scope = scopeKeyFor(environmentId);
  const out = new Map<string, ResolvedVariable>();
  for (const v of variables) if (v.scopeKey === WORKSPACE_SCOPE) out.set(v.key, { key: v.key, value: v.value, source: "workspace" });
  for (const v of variables) if (v.scopeKey === scope) out.set(v.key, { key: v.key, value: v.value, source: "environment" });
  return [...out.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Stable digest of what an environment resolved to, for release evidence. */
export function resolvedDigest(resolved: readonly ResolvedVariable[]): string {
  const canonical = JSON.stringify(resolved.map((v) => [v.key, v.value]));
  return createHash("sha256").update(canonical).digest("hex");
}

/** Keys set for some environments but with no workspace default: environments without an override will not see them. */
export function partialKeys(variables: readonly StoredVariable[], environmentIds: readonly string[]): Array<{ key: string; missingIn: string[] }> {
  const defaults = new Set(variables.filter((v) => v.scopeKey === WORKSPACE_SCOPE).map((v) => v.key));
  const byKey = new Map<string, Set<string>>();
  for (const v of variables) if (v.scopeKey !== WORKSPACE_SCOPE) {
    const set = byKey.get(v.key) ?? new Set<string>(); set.add(v.scopeKey.slice(4)); byKey.set(v.key, set);
  }
  const gaps: Array<{ key: string; missingIn: string[] }> = [];
  for (const [key, set] of [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (defaults.has(key)) continue;
    const missingIn = environmentIds.filter((id) => !set.has(id));
    if (missingIn.length) gaps.push({ key, missingIn });
  }
  return gaps;
}
