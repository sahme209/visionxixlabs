export type WebsiteBuildTier = "starter" | "professional" | "done_for_you";

export const WEBSITE_BUILD_TIERS = {
  starter: {
    id: "starter" as const,
    name: "Starter AI Build",
    price: 49,
    description: "AI-generated website preview, 3 revisions, hosted preview link",
    revisions: 3,
    productionDeploy: false,
  },
  professional: {
    id: "professional" as const,
    name: "Professional Publish",
    price: 399,
    description: "Domain connection, production deployment, performance optimization, basic SEO",
    revisions: 0, // unlimited for publish
    productionDeploy: true,
  },
  done_for_you: {
    id: "done_for_you" as const,
    name: "Done-For-You Premium",
    price: 0, // placeholder; use priceRange for display
    priceRange: "$2,000–$5,000",
    description: "Custom design adjustments, copy refinement, strategy consultation",
    revisions: 0,
    productionDeploy: true,
  },
} as const;
