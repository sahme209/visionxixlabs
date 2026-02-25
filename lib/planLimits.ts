/**
 * Plan limits — must match pricing page promises.
 * starter | growth | scale | enterprise
 */

export type PlanId = "starter" | "growth" | "scale" | "enterprise";

export const PLAN_LIMITS: Record<PlanId, { bots: number; messages: number; pages: number }> = {
  starter: { bots: 1, messages: 6000, pages: 2500 },
  growth: { bots: 3, messages: 15000, pages: 15000 },
  scale: { bots: 8, messages: 60000, pages: 80000 },
  enterprise: { bots: 999, messages: 999999, pages: 500000 },
};

export function getPlanLimits(plan: string | null): { bots: number; messages: number; pages: number } {
  const id = (plan || "starter") as PlanId;
  return PLAN_LIMITS[id] ?? PLAN_LIMITS.starter;
}
