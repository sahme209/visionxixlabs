/** Unified membership tiers — same as visionxix-ai/pricing */
export type WebsiteBuildTier = "starter" | "growth" | "scale" | "enterprise";

export const WEBSITE_BUILD_TIERS = {
  starter: {
    id: "starter" as const,
    name: "Starter",
    price: 35,
    priceLabel: "$35/mo",
    description: "1 chatbot, 6k messages/mo, 2.5k pages, AI Website Builder, Axiom, cloud guidance",
    revisions: 3,
    productionDeploy: false,
    popular: false,
  },
  growth: {
    id: "growth" as const,
    name: "Growth",
    price: 75,
    priceLabel: "$75/mo",
    description: "3 chatbots, 15k messages/mo, 15k pages, API, integrations, full suite included",
    revisions: 0,
    productionDeploy: true,
    popular: true,
  },
  scale: {
    id: "scale" as const,
    name: "Scale",
    price: 249,
    priceLabel: "$249/mo",
    description: "8 chatbots, 60k messages/mo, 80k pages, priority support, full suite included",
    revisions: 0,
    productionDeploy: true,
    popular: false,
  },
  enterprise: {
    id: "enterprise" as const,
    name: "Enterprise",
    price: 0,
    priceLabel: "Custom",
    priceRange: "Custom",
    description: "Unlimited chatbots, custom volume, optional self-host, SOC2-ready, dedicated success",
    revisions: 0,
    productionDeploy: true,
    popular: false,
  },
} as const;

/** Map legacy tiers for backward compat; resolve to canonical membership tier */
export function resolveTier(tier: string): keyof typeof WEBSITE_BUILD_TIERS {
  const t = tier.toLowerCase();
  if (t === "done_for_you") return "enterprise";
  if (t === "professional") return "growth";
  if (t in WEBSITE_BUILD_TIERS) return tier as keyof typeof WEBSITE_BUILD_TIERS;
  return "starter";
}
