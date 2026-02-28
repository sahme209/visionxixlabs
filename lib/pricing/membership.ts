/**
 * Canonical membership config — single source of truth.
 * Matches https://visionxixlabs.com/visionxix-ai/pricing
 * All paid products (Axiom, Cloud Studio, Website Builder, Chatbots, Automation) use this.
 */

export type MembershipPlanId = "starter" | "growth" | "scale" | "enterprise";

/** Cloud Operator tier equivalent for this membership */
export type OperatorTierEquivalent = "free" | "pro" | "growth" | "enterprise";

/** Cloud Studio tier equivalent */
export type StudioTierEquivalent = "free" | "professional" | "enterprise";

export interface MembershipPlan {
  id: MembershipPlanId;
  name: string;
  /** Monthly price — null for Enterprise (Custom) */
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  description: string;
  popular?: boolean;

  /** Chatbot limits */
  bots: number;
  messagesPerMonth: number;
  pages: number;
  teamMembers: number;

  /** Refresh/scan cadence */
  refresh: "manual" | "monthly" | "weekly" | "daily";
  autoScan?: boolean;

  /** Product capability mapping */
  axiom: {
    tier: OperatorTierEquivalent;
    label: string;
    includes: string[];
  };
  cloudStudio: {
    tier: StudioTierEquivalent;
    includes: string[];
  };
  websiteBuilder: {
    includes: string[];
  };
  automation: {
    /** Can use autonomous remediation (GitHub PR, etc.) */
    remediationEnabled: boolean;
    /** Can link cloud connectors (AWS, Azure, GCP) */
    cloudConnectors: boolean;
  };

  /** All feature bullets for pricing card */
  features: string[];
}

/** Canonical membership plans — matches visionxix-ai/pricing exactly */
export const MEMBERSHIP_PLANS: Record<MembershipPlanId, MembershipPlan> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthlyPrice: 35,
    yearlyPrice: 252,
    description: "For small sites and solo founders",
    popular: false,
    bots: 1,
    messagesPerMonth: 6000,
    pages: 2500,
    teamMembers: 1,
    refresh: "manual",
    axiom: {
      tier: "free",
      label: "Analysis",
      includes: [
        "Infrastructure scores and summary dashboard",
        "Executive summary",
        "No configs or technical outputs (upgrade for Roadmap)",
      ],
    },
    cloudStudio: {
      tier: "free",
      includes: ["Summary-only output", "No downloadable artifacts"],
    },
    websiteBuilder: {
      includes: ["AI Website Builder", "3 revisions", "No production deploy"],
    },
    automation: {
      remediationEnabled: false,
      cloudConnectors: false,
    },
    features: [
      "1 chatbot",
      "Up to 6k messages / month",
      "Up to 2,500 pages",
      "Manual refresh",
      "1 team member",
      "White-label branding included",
      "95+ languages",
      "Lead capture",
      "Embed on your site",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthlyPrice: 75,
    yearlyPrice: 540,
    description: "For growing teams and multiple sites",
    popular: true,
    bots: 3,
    messagesPerMonth: 15000,
    pages: 15000,
    teamMembers: 5,
    refresh: "monthly",
    axiom: {
      tier: "pro",
      label: "Roadmap",
      includes: [
        "Full 30-day optimization plan",
        "CI/CD YAML, Dockerfile, Terraform templates",
        "Cost breakdown, savings estimates",
        "Security hardening recommendations",
        "GitHub connector",
      ],
    },
    cloudStudio: {
      tier: "professional",
      includes: ["Full output", "Downloadable artifacts", "CI/CD YAML", "Architecture diagrams"],
    },
    websiteBuilder: {
      includes: ["Unlimited revisions", "Production deploy", "CDN", "CI/CD"],
    },
    automation: {
      remediationEnabled: true,
      cloudConnectors: true,
    },
    features: [
      "Up to 3 chatbots",
      "Up to 15k messages / month",
      "Up to 15,000 pages",
      "Auto refresh (monthly)",
      "Up to 5 team members",
      "White-label branding included",
      "Integrations (Zendesk, Intercom, Crisp)",
      "Full API access",
      "Rate limiting",
      "95+ languages",
      "Lead capture + escalation to human",
      "Conversation analytics",
    ],
  },
  scale: {
    id: "scale",
    name: "Scale",
    monthlyPrice: 249,
    yearlyPrice: 1794,
    description: "For high-traffic sites and agencies",
    popular: false,
    bots: 8,
    messagesPerMonth: 60000,
    pages: 80000,
    teamMembers: 15,
    refresh: "weekly",
    autoScan: true,
    axiom: {
      tier: "growth",
      label: "Automation Signals",
      includes: [
        "Everything in Roadmap",
        "Drift detection and trend history",
        "Continuous reassessment (weekly)",
        "AWS, Azure, GCP connectors",
      ],
    },
    cloudStudio: {
      tier: "professional",
      includes: ["Everything in Growth", "Priority generation"],
    },
    websiteBuilder: {
      includes: ["Everything in Growth", "Priority deploy"],
    },
    automation: {
      remediationEnabled: true,
      cloudConnectors: true,
    },
    features: [
      "Up to 8 chatbots",
      "Up to 60k messages / month",
      "Up to 80,000 pages",
      "Auto refresh (weekly)",
      "Auto scan (daily)",
      "Up to 15 team members",
      "White-label branding included",
      "Integrations + API + Webhooks",
      "Priority support",
      "95+ languages",
      "Lead capture + escalation to human",
      "Conversation analytics + email summaries",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    yearlyPrice: null,
    description: "Custom volume, your cloud, SOC2-ready",
    popular: false,
    bots: 999,
    messagesPerMonth: 999999,
    pages: 500000,
    teamMembers: 999,
    refresh: "daily",
    autoScan: true,
    axiom: {
      tier: "enterprise",
      label: "Strategic Advisory",
      includes: [
        "Everything in Automation Signals",
        "Policy packs, enterprise brief",
        "Strategic engagement and implementation support",
        "Unlimited connectors",
      ],
    },
    cloudStudio: {
      tier: "enterprise",
      includes: ["Everything in Scale", "Custom deliverables", "Dedicated support"],
    },
    websiteBuilder: {
      includes: ["Everything in Scale", "Custom volume", "SLA"],
    },
    automation: {
      remediationEnabled: true,
      cloudConnectors: true,
    },
    features: [
      "Unlimited chatbots",
      "Custom message volume",
      "Up to 500k+ pages",
      "Auto refresh (daily)",
      "Unlimited team members",
      "Optional self-host / your cloud",
      "SOC2-ready, RBAC, audit logs",
      "Custom integrations",
      "Dedicated success manager",
      "SLA",
    ],
  },
};

/** Included in every plan (from website) */
export const INCLUDED_IN_EVERY_PLAN = [
  "Vision XIX AI chatbots (white-label)",
  "Axiom Cloud Operator (infra scoring & roadmaps)",
  "AI Website Builder (prompt-driven sites)",
  "Cloud Studio (cloud project setup)",
  "Cloud solutions guidance (AWS, Azure, GCP)",
  "AI solutions & engineering resources",
] as const;

export const ADDONS = [
  { name: "Extra 10k messages", monthly: 25, yearly: 180 },
  { name: "Extra 25k messages", monthly: 49, yearly: 353 },
] as const;

/** User.plan (from Stripe) → MembershipPlan */
export function getMembershipPlan(plan: string | null | undefined): MembershipPlan {
  const id = (plan ?? "starter").toLowerCase() as MembershipPlanId;
  return MEMBERSHIP_PLANS[id] ?? MEMBERSHIP_PLANS.starter;
}

/** User.plan → Cloud Operator tier for gating */
export function membershipToOperatorTier(plan: string | null | undefined): OperatorTierEquivalent {
  return getMembershipPlan(plan).axiom.tier;
}

/** User.plan → Cloud Studio tier for gating */
export function membershipToStudioTier(plan: string | null | undefined): StudioTierEquivalent {
  return getMembershipPlan(plan).cloudStudio.tier;
}

/** Check if plan has automation remediation (GitHub PR, etc.) */
export function hasAutomationRemediation(plan: string | null | undefined): boolean {
  return getMembershipPlan(plan).automation.remediationEnabled;
}

/** Check if plan has cloud connectors (AWS, Azure, GCP) */
export function hasCloudConnectors(plan: string | null | undefined): boolean {
  return getMembershipPlan(plan).automation.cloudConnectors;
}
