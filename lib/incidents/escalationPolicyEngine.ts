/**
 * Pure escalation policy engine.
 *
 * Given an incident's age + severity + acknowledgement state, decide
 * which tier of the escalation policy is currently active. Pure /
 * deterministic. Caller is responsible for actually paging — this
 * module just says "who should be paged right now".
 */

export type EscalationTier = "primary" | "secondary" | "manager" | "exec";

export interface PolicyStep {
  tier: EscalationTier;
  /** Minutes since open before this tier takes over. */
  afterMinutes: number;
}

export interface EscalationInput {
  openedAtSec: number;        // unix seconds
  nowSec: number;
  /** Has any operator acked the page? */
  acknowledged: boolean;
  severity: "low" | "medium" | "high" | "critical";
  /** Per-severity policy: list of escalation steps in order. */
  policyBySeverity: Record<EscalationInput["severity"], readonly PolicyStep[]>;
}

export interface EscalationDecision {
  /** Currently active escalation tier (null when acked or severity unknown). */
  activeTier: EscalationTier | null;
  /** Minutes since the incident opened. */
  ageMinutes: number;
  /** Next tier that would take over if not acked, with the deadline. */
  nextTier: EscalationTier | null;
  nextAtMinutes: number | null;
}

export function decideEscalation(input: EscalationInput): EscalationDecision {
  const ageMinutes = Math.max(0, Math.floor((input.nowSec - input.openedAtSec) / 60));

  if (input.acknowledged) {
    return { activeTier: null, ageMinutes, nextTier: null, nextAtMinutes: null };
  }

  const policy = input.policyBySeverity[input.severity];
  if (!policy || policy.length === 0) {
    return { activeTier: null, ageMinutes, nextTier: null, nextAtMinutes: null };
  }

  // Sort defensively by afterMinutes asc.
  const sorted = [...policy].sort((a, b) => a.afterMinutes - b.afterMinutes);

  let active: EscalationTier | null = null;
  let nextTier: EscalationTier | null = null;
  let nextAt: number | null = null;
  for (const step of sorted) {
    if (ageMinutes >= step.afterMinutes) {
      active = step.tier;
    } else {
      nextTier = step.tier;
      nextAt = step.afterMinutes;
      break;
    }
  }
  return { activeTier: active, ageMinutes, nextTier, nextAtMinutes: nextAt };
}
