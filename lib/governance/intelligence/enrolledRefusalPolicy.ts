/**
 * What an enrolled workspace refuses until its family has reviewed Governance
 * admission (owner decision 2026-11-09, coverage catalog F17, F18, M01, M02).
 * Pure: classification only. The IO callers check enrollment themselves with
 * assertNoGovernanceEnrollmentForMutation, which also fails closed when
 * enrollment cannot be read.
 *
 * - F17 notifications: discretionary sends are refused; safety alerts always go
 *   out, so an emergency is never silently suppressed.
 * - F18 webhooks: tenant webhook deliveries are refused (kept for retry, never
 *   marked delivered).
 * - M01/M02 management: only changes that INCREASE privilege or loosen policy
 *   are refused. Demotion, removal, revocation and tightening keep working, so
 *   people can always reduce access.
 */

export const SAFETY_NOTIFICATION_KINDS = [
  "autonomy_halt_needs_human",
  "autonomy_halt_unsafe",
  "autonomy_halt_policy",
  "critical_telemetry_signal",
  "critical_incident",
] as const;

/** A safety alert must be delivered even while enrolled. */
export function isSafetyNotification(n: { kind?: string | null; severity?: string | null; outcome?: string | null }): boolean {
  if (n.severity === "critical" || n.outcome === "critical") return true;
  return typeof n.kind === "string" && (SAFETY_NOTIFICATION_KINDS as readonly string[]).includes(n.kind);
}

/** Security signals a customer must receive even while enrolled (tampering, credential changes). */
export const SAFETY_WEBHOOK_KINDS = ["audit.integrity_failed", "api_key.created", "api_key.revoked"] as const;
export function isSafetyWebhook(kind: string | null | undefined): boolean {
  return typeof kind === "string" && (SAFETY_WEBHOOK_KINDS as readonly string[]).includes(kind);
}

const AUTONOMY_RANK: Readonly<Record<string, number>> = { observer: 0, review: 1, assisted: 2, autonomous: 3 };
/**
 * M02: true when an autonomy change gives the Agent more room (a looser mode or
 * a higher per-cycle limit). No current charter is treated as the strictest
 * setting, and an unknown mode as the loosest (fail closed).
 */
export function isAutonomyLoosening(current: { mode: string; perCycleActionLimit: number } | null, next: { mode: string; perCycleActionLimit: number }): boolean {
  const from = current ?? { mode: "observer", perCycleActionLimit: 1 };
  const fromRank = AUTONOMY_RANK[from.mode] ?? 3, toRank = AUTONOMY_RANK[next.mode] ?? 99;
  return toRank > fromRank || next.perCycleActionLimit > from.perCycleActionLimit;
}

/**
 * M02: true when an AI provider policy change gives AI more reach: turning AI on,
 * allowing a provider, or approving a gateway model that was not allowed before.
 * Removing providers/models or turning AI off is tightening. No stored policy is
 * treated as the strictest (AI off, nothing allowed), so enabling anything counts.
 */
export function isProviderPolicyLoosening(
  current: { enabled: boolean; allowedProviders: readonly string[]; approvedModels: readonly string[] } | null,
  next: { enabled: boolean; allowedProviders: readonly string[]; approvedModels: readonly string[] },
): boolean {
  const from = current ?? { enabled: false, allowedProviders: [], approvedModels: [] };
  if (!next.enabled) return false;
  if (!from.enabled) return true;
  const newly = (a: readonly string[], b: readonly string[]) => a.some((x) => !b.includes(x));
  return newly(next.allowedProviders, from.allowedProviders) || newly(next.approvedModels, from.approvedModels);
}

/** Lower number means more privilege. Unknown roles are treated as the most privileged (fail closed). */
const ROLE_RANK: Readonly<Record<string, number>> = { owner: 0, admin: 1, operator: 2, security_reviewer: 3, finance_viewer: 4, read_only: 5 };
const rank = (role: string | null | undefined) => (role && role in ROLE_RANK ? ROLE_RANK[role] : -1);

/** True when moving from `current` to `next` grants more privilege (including any new membership). */
export function isPrivilegeIncrease(current: string | null | undefined, next: string | null | undefined): boolean {
  if (next === null || next === undefined) return false; // removal never increases privilege
  if (current === null || current === undefined) return true; // a new member or invitation is an increase
  return rank(next) < rank(current) || rank(next) === -1;
}
