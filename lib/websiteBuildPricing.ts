export type WebsiteBuildTier = "starter" | "professional" | "enterprise";

export const WEBSITE_BUILD_TIERS = {
  starter: {
    id: "starter" as const,
    name: "Starter",
    price: 49,
    description: "AI build, managed cloud preview, 3 revisions",
    revisions: 3,
    productionDeploy: false,
  },
  professional: {
    id: "professional" as const,
    name: "Professional",
    price: 499,
    description: "Production deployment, cloud provider selection, CDN, SSL, CI/CD enabled",
    revisions: 0,
    productionDeploy: true,
  },
  enterprise: {
    id: "enterprise" as const,
    name: "Enterprise",
    price: 0,
    priceRange: "Custom pricing",
    description: "Multi-cloud deployment, networking, security hardening, performance optimization",
    revisions: 0,
    productionDeploy: true,
  },
} as const;

/** Map legacy done_for_you to enterprise for backward compat */
export function resolveTier(tier: string): keyof typeof WEBSITE_BUILD_TIERS {
  if (tier === "done_for_you") return "enterprise";
  return (WEBSITE_BUILD_TIERS[tier as keyof typeof WEBSITE_BUILD_TIERS] ? tier : "starter") as keyof typeof WEBSITE_BUILD_TIERS;
}
