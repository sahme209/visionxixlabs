/**
 * Tier-cap enforcement helper.
 *
 * Pure function that takes a tier + a usage measurement and returns
 * whether the next operation should be allowed. Used by the autonomy
 * scheduler (cycle cap) and outbound lane (notification cap) so the
 * caps shown on the pricing page are actually enforced.
 *
 * Hard rules:
 *   - Pure: no DB call. The caller supplies the current count.
 *   - -1 cap → unlimited; always allow.
 *   - 0 cap → always deny (lets us programmatically pause a tier).
 *   - Returns a typed { allowed, remaining, capacity, capName }
 *     so the caller can both check + log the verdict.
 */

import type { BillingTier, TierSpec } from "./tierCatalog";
import { tierSpec } from "./tierCatalog";

export type CapName =
  | "autonomyCyclesPerDay"
  | "stagedRunbooks"
  | "outboundPerDay"
  | "cloudConnectors";

export interface CapDecision {
  capName: CapName;
  tier: BillingTier;
  capacity: number;
  /** Caller-supplied current usage count. */
  used: number;
  /** capacity - used, floored at 0. -1 when capacity is unlimited. */
  remaining: number;
  allowed: boolean;
  /** Operator-readable explanation. */
  reason: string;
}

export function checkCap(opts: {
  tier: BillingTier;
  capName: CapName;
  used: number;
}): CapDecision {
  const spec: TierSpec = tierSpec(opts.tier);
  const capacity = spec.caps[opts.capName];

  // Unlimited.
  if (capacity < 0) {
    return {
      capName: opts.capName,
      tier: opts.tier,
      capacity,
      used: opts.used,
      remaining: -1,
      allowed: true,
      reason: `Tier ${opts.tier} has unlimited ${opts.capName}.`,
    };
  }

  const remaining = Math.max(0, capacity - opts.used);
  const allowed = opts.used < capacity;

  return {
    capName: opts.capName,
    tier: opts.tier,
    capacity,
    used: opts.used,
    remaining,
    allowed,
    reason: allowed
      ? `${opts.used}/${capacity} ${opts.capName} used on tier ${opts.tier}.`
      : `Tier ${opts.tier} cap reached for ${opts.capName} (${opts.used}/${capacity}).`,
  };
}

/**
 * Compute usage from a per-day rolling count (or unbounded count).
 * Caller provides the count; this helper returns the typed cap
 * decision plus a structured outcome the dashboard can render.
 */
export function checkDailyCap(opts: {
  tier: BillingTier;
  capName: "autonomyCyclesPerDay" | "outboundPerDay";
  usedToday: number;
}): CapDecision {
  return checkCap({ tier: opts.tier, capName: opts.capName, used: opts.usedToday });
}
