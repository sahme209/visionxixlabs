/**
 * Self-service API key policy (workspace owners/admins in /control). Pure.
 *
 * Tighter than the platform-admin mint path on purpose: only governance and
 * read scopes, no wildcards, no trigger/admin verbs, a mandatory expiry of at
 * most 90 days, and a cap on active keys per workspace. Closed unions make an
 * unknown scope a compile error, not a silent grant.
 */
import type { ApiKeyScope } from "./apiKeyScope";

export const SELF_SERVICE_SCOPES = ["governance:read", "governance:request", "pipeline:read", "release_gate:read", "webhook:read"] as const satisfies readonly ApiKeyScope[];
export type SelfServiceScope = (typeof SELF_SERVICE_SCOPES)[number];
export const MAX_ACTIVE_KEYS = 20;
export const MAX_EXPIRY_DAYS = 90;
export const DEFAULT_EXPIRY_DAYS = 30;

export type SelfServiceMintDecision =
  | { ok: true; name: string; scopes: SelfServiceScope[]; expiresAt: Date; env: "live" | "test" }
  | { ok: false; error: "name_required" | "scopes_required" | "scope_not_allowed" | "expiry_invalid" | "too_many_keys" };

export function decideSelfServiceMint(input: { name: unknown; scopes: unknown; expiresInDays?: unknown; env?: unknown; activeKeys: number }, now: Date): SelfServiceMintDecision {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80 || /[\x00-\x1f\x7f]/.test(name)) return { ok: false, error: "name_required" };
  if (!Array.isArray(input.scopes) || input.scopes.length === 0) return { ok: false, error: "scopes_required" };
  const scopes = [...new Set(input.scopes)];
  if (!scopes.every((s): s is SelfServiceScope => typeof s === "string" && (SELF_SERVICE_SCOPES as readonly string[]).includes(s))) return { ok: false, error: "scope_not_allowed" };
  const days = input.expiresInDays === undefined ? DEFAULT_EXPIRY_DAYS : input.expiresInDays;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > MAX_EXPIRY_DAYS) return { ok: false, error: "expiry_invalid" };
  if (input.activeKeys >= MAX_ACTIVE_KEYS) return { ok: false, error: "too_many_keys" };
  return { ok: true, name, scopes: scopes as SelfServiceScope[], expiresAt: new Date(now.getTime() + days * 86_400_000), env: input.env === "test" ? "test" : "live" };
}
