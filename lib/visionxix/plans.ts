/**
 * Vision XIX Labs AI — Plan limits aligned with pricing page
 * https://visionxixlabs.com/visionxix-ai/pricing
 */

export type PlanTier = "starter" | "growth" | "scale" | "enterprise" | "demo";

export interface PlanLimits {
  messagesPerMonth: number;
  pagesMax: number;
  chatbotsMax: number;
  teamMembersMax: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    messagesPerMonth: 6_000,
    pagesMax: 2_500,
    chatbotsMax: 1,
    teamMembersMax: 1,
  },
  growth: {
    messagesPerMonth: 15_000,
    pagesMax: 15_000,
    chatbotsMax: 3,
    teamMembersMax: 5,
  },
  scale: {
    messagesPerMonth: 60_000,
    pagesMax: 80_000,
    chatbotsMax: 8,
    teamMembersMax: 15,
  },
  enterprise: {
    messagesPerMonth: 500_000, // Custom — high default
    pagesMax: 500_000,
    chatbotsMax: 999,
    teamMembersMax: 999,
  },
  demo: {
    messagesPerMonth: 1_000, // Demo cap — enough for try-before-buy
    pagesMax: 100,
    chatbotsMax: 1,
    teamMembersMax: 1,
  },
};

/** Add-on: Extra 10k messages for +$25/mo */
export const ADDON_10K_MESSAGES = 10_000;

/** Add-on: Extra 25k messages for +$49/mo */
export const ADDON_25K_MESSAGES = 25_000;

export function getEffectiveMessageLimit(
  plan: PlanTier,
  addOn10k: boolean = false,
  addOn25k: boolean = false
): number {
  const base = PLAN_LIMITS[plan].messagesPerMonth;
  let extra = 0;
  if (addOn10k) extra += ADDON_10K_MESSAGES;
  if (addOn25k) extra += ADDON_25K_MESSAGES;
  return base + extra;
}
