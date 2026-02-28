/**
 * Plan limits — derived from membership (visionxix-ai/pricing).
 * starter | growth | scale | enterprise
 */

import { getMembershipPlan, type MembershipPlanId } from "@/lib/pricing/membership";

export type PlanId = MembershipPlanId;

/** @deprecated Use getMembershipPlan() for full config. Kept for backward compat. */
export const PLAN_LIMITS: Record<PlanId, { bots: number; messages: number; pages: number }> = {
  starter: { bots: 1, messages: 6000, pages: 2500 },
  growth: { bots: 3, messages: 15000, pages: 15000 },
  scale: { bots: 8, messages: 60000, pages: 80000 },
  enterprise: { bots: 999, messages: 999999, pages: 500000 },
};

export function getPlanLimits(plan: string | null): { bots: number; messages: number; pages: number } {
  const m = getMembershipPlan(plan);
  return { bots: m.bots, messages: m.messagesPerMonth, pages: m.pages };
}
