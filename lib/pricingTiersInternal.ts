/**
 * Internal pricing tiers – for your reference only.
 * Not displayed on the public site. View at /internal/pricing?key=YOUR_SECRET
 * (set INTERNAL_PRICING_KEY in .env.local or Vercel).
 */

export type PricingTierInternal = {
  id: string;
  name: string;
  duration: string;
  /** Your internal price (e.g. "£X,XXX" or "From $Y" – not shown publicly) */
  price: string;
  includes: string[];
  bestFor: string;
  notes?: string;
};

export const pricingTiersInternal: PricingTierInternal[] = [
  {
    id: "assessment",
    name: "Cloud Assessment",
    duration: "1–2 weeks",
    price: "Set your price",
    includes: [
      "Current-state review of AWS, Azure, and/or GCP",
      "Risk and opportunity analysis",
      "Prioritized roadmap with quick wins and longer-term work",
      "Executive-friendly summary of key findings",
    ],
    bestFor: "Teams needing clarity on where to start.",
  },
  {
    id: "foundation-build",
    name: "Foundation Build",
    duration: "2–6 weeks",
    price: "Set your price",
    includes: [
      "Baseline AWS, Azure, and/or GCP landing zone",
      "Infrastructure as Code for core platform",
      "Initial CI/CD pipelines wired to environments",
      "Monitoring, alerting, and security guardrails",
    ],
    bestFor: "Teams building or standardizing a cloud platform.",
  },
  {
    id: "optimization-operations",
    name: "Optimization & Operations",
    duration: "Ongoing",
    price: "Set your price",
    includes: [
      "Regular cost optimization and FinOps reviews",
      "Reliability and incident reduction initiatives",
      "Support for platform changes and improvements",
      "Advisory support for roadmap and architecture decisions",
    ],
    bestFor: "Teams investing in continuous improvement.",
  },
];
