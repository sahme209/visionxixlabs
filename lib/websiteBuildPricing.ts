/**
 * Website Builder tiers — derived from membership (visionxix-ai/pricing).
 */

import {
  MEMBERSHIP_PLANS,
  type MembershipPlanId,
} from "@/lib/pricing/membership";

export type WebsiteBuildTier = MembershipPlanId;

export const WEBSITE_BUILD_TIERS = {
  starter: {
    id: "starter" as const,
    name: MEMBERSHIP_PLANS.starter.name,
    price: MEMBERSHIP_PLANS.starter.monthlyPrice ?? 0,
    priceLabel: "$35/mo",
    description: MEMBERSHIP_PLANS.starter.websiteBuilder.includes.join(", "),
    revisions: 3,
    productionDeploy: false,
    popular: false,
  },
  growth: {
    id: "growth" as const,
    name: MEMBERSHIP_PLANS.growth.name,
    price: MEMBERSHIP_PLANS.growth.monthlyPrice ?? 0,
    priceLabel: "$75/mo",
    description: MEMBERSHIP_PLANS.growth.websiteBuilder.includes.join(", "),
    revisions: 0,
    productionDeploy: true,
    popular: true,
  },
  scale: {
    id: "scale" as const,
    name: MEMBERSHIP_PLANS.scale.name,
    price: MEMBERSHIP_PLANS.scale.monthlyPrice ?? 0,
    priceLabel: "$249/mo",
    description: MEMBERSHIP_PLANS.scale.websiteBuilder.includes.join(", "),
    revisions: 0,
    productionDeploy: true,
    popular: false,
  },
  enterprise: {
    id: "enterprise" as const,
    name: MEMBERSHIP_PLANS.enterprise.name,
    price: 0,
    priceLabel: "Custom",
    priceRange: "Custom",
    description: MEMBERSHIP_PLANS.enterprise.websiteBuilder.includes.join(", "),
    revisions: 0,
    productionDeploy: true,
    popular: false,
  },
} as const;

/** Map legacy tiers for backward compat; resolve to canonical membership tier */
export function resolveTier(tier: string): keyof typeof WEBSITE_BUILD_TIERS {
  const t = tier.toLowerCase();
  if (t === "done_for_you") return "enterprise";
  if (t === "professional" || t === "pro") return "growth";
  if (t in WEBSITE_BUILD_TIERS) return tier as keyof typeof WEBSITE_BUILD_TIERS;
  return "starter";
}
