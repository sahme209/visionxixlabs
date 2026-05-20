/**
 * Tier gate — convenience facade around plan + cap + counter.
 *
 * One call answers "may this tenant do one more <capName> today?"
 * and (on allow) increments the counter atomically. The autonomy
 * scheduler + outbound lane use this single helper instead of
 * wiring through three modules.
 *
 * Hard rules:
 *   - Read-only when allow=false — no counter increment. The caller
 *     can re-ask later without polluting today's number.
 *   - On DB outage, plan resolution falls back to 'trial' (the most
 *     permissive). Combined with the counter store's fail-open
 *     behavior this means we over-allow during outages — by design.
 *   - Pure plumbing: no Slack send, no DB write beyond the counter
 *     increment. Pages-when-cap-hit is the caller's responsibility.
 */

import "server-only";

import { readBillingPlan } from "./tenantBillingStore";
import { checkCap, type CapDecision, type CapName } from "./tierCapEnforcer";
import { incrementUsageCount, readUsageCount, todayUtcKey } from "./usageCounterStore";

export interface GateDecision extends CapDecision {
  /** When true, the counter has been incremented. */
  consumed: boolean;
  /** UTC YYYY-MM-DD the decision applies to. */
  dateKey: string;
}

export async function gateAndConsume(opts: {
  organizationId: string;
  capName: CapName;
}): Promise<GateDecision> {
  const dateKey = todayUtcKey();
  const plan = await readBillingPlan(opts.organizationId).catch(() => null);
  // Default to "trial" plan when read fails — most-permissive fallback.
  const tier = plan?.tier ?? "trial";

  const used = await readUsageCount({
    organizationId: opts.organizationId,
    capName: opts.capName,
    dateKey,
  });
  const decision = checkCap({ tier, capName: opts.capName, used });
  if (!decision.allowed) {
    return { ...decision, consumed: false, dateKey };
  }
  await incrementUsageCount({
    organizationId: opts.organizationId,
    capName: opts.capName,
    dateKey,
  });
  return { ...decision, consumed: true, dateKey };
}

/**
 * Read-only check — does NOT increment the counter. Useful for
 * showing "X of Y used today" on the dashboard.
 */
export async function peekGate(opts: {
  organizationId: string;
  capName: CapName;
}): Promise<GateDecision> {
  const dateKey = todayUtcKey();
  const plan = await readBillingPlan(opts.organizationId).catch(() => null);
  const tier = plan?.tier ?? "trial";
  const used = await readUsageCount({
    organizationId: opts.organizationId,
    capName: opts.capName,
    dateKey,
  });
  const decision = checkCap({ tier, capName: opts.capName, used });
  return { ...decision, consumed: false, dateKey };
}
