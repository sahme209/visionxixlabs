/**
 * Pricing plan registry — Phase 381.
 *
 * Source of truth for the four go-to-market tiers. Each plan declares
 * price + every entitlement that maps to a cost driver. Limits are
 * conservative enough that the unit-economics calculator predicts
 * positive gross margin under expected usage; if a tier ever stops
 * predicting positive margin (e.g. AI rates rise), the
 * computePlanMargin() warnings surface that to the operator.
 *
 * This catalog is layered alongside the legacy TIER_CATALOG / Stripe
 * webhook plumbing — it does not replace it. The Stripe `tier` field
 * still maps to a `PlanTier` via planForStripeTier() so we keep one
 * billing source of truth.
 */

export type PlanTier = "starter" | "growth" | "business" | "enterprise";

export interface PlanEntitlements {
  /** Hard seat cap. Enterprise: null = negotiated. */
  maxUsers: number | null;
  maxWorkspaces: number | null;
  maxConnectors: number | null;
  maxCloudAccounts: number | null;
  maxRepositories: number | null;
  maxDesktopAgents: number | null;
  /** Number of engineers from the workforce registry the org can enable. */
  maxAgentsEnabled: number | null;

  /** AI usage included per month. Real usage is metered via UsageEvent. */
  includedAICreditsCents: number;
  includedAIInputTokens: number;
  includedAIOutputTokens: number;

  /** Workflow / automation throughput. */
  monthlyAgentRuns: number | null;
  monthlyAutomationRuns: number | null;
  monthlyConnectorSyncs: number | null;
  monthlyCloudScans: number | null;
  monthlySecurityScans: number | null;
  monthlyReports: number | null;
  monthlyPdfExports: number | null;

  /** Monitoring + retention. */
  monitoringEventsPerMonth: number | null;
  logRetentionDays: number;
  auditLogRetentionDays: number;

  /** Feature toggles. */
  approvalWorkflows: boolean;
  incidentManagement: boolean;
  serviceCatalog: boolean;
  pipelines: boolean;
  aiCodingLoop: boolean;
  sso: boolean;
  advancedRbac: boolean;
  customConnectors: boolean;
  privateDeployment: boolean;

  /** "community" | "standard" | "priority" | "dedicated". */
  supportLevel: "community" | "standard" | "priority" | "dedicated";

  /** Overage behavior when AI credit pool is exhausted. */
  overagePolicy: "hard_stop" | "soft_warn" | "metered_billing" | "custom_contract";
  /** Overage rate when metered_billing — cents per 1M input tokens at retail markup. */
  overageInputCentsPerMillion: number | null;
  overageOutputCentsPerMillion: number | null;
}

export interface PricingPlan {
  tier: PlanTier;
  displayName: string;
  tagline: string;
  /** Monthly price in cents (USD). 0 = free trial-style; null = enterprise contact-us. */
  monthlyPriceCents: number | null;
  /** Annual price in cents — usually monthly × 12 × 0.8 (20% discount). */
  annualPriceCents: number | null;
  entitlements: PlanEntitlements;
  /** Operator-friendly feature bullets for the marketing page. */
  highlights: ReadonlyArray<string>;
}

const STARTER: PricingPlan = {
  tier: "starter",
  displayName: "Starter",
  tagline: "For small teams testing VisionXIXLabs.",
  monthlyPriceCents: 19900,    // $199/mo
  annualPriceCents: 191040,    // ~$15,920/yr → $1,326/mo equivalent (20% off)
  highlights: [
    "5 users · 1 workspace",
    "3 connectors · 1 cloud account",
    "5 AI engineers enabled",
    "$25 AI credits/month (~8M input tokens at Haiku rate)",
    "200 agent runs · 50 automation runs",
    "30-day log retention · community support",
    "Hard stop at AI credit cap",
  ],
  entitlements: {
    maxUsers: 5,
    maxWorkspaces: 1,
    maxConnectors: 3,
    maxCloudAccounts: 1,
    maxRepositories: 5,
    maxDesktopAgents: 0,
    maxAgentsEnabled: 5,
    includedAICreditsCents: 2500,        // $25
    includedAIInputTokens: 8_000_000,    // matches Haiku 4.5 input @ $1/1M
    includedAIOutputTokens: 500_000,     // $2.50 at Haiku 4.5 output
    monthlyAgentRuns: 200,
    monthlyAutomationRuns: 50,
    monthlyConnectorSyncs: 1500,
    monthlyCloudScans: 30,
    monthlySecurityScans: 30,
    monthlyReports: 10,
    monthlyPdfExports: 20,
    monitoringEventsPerMonth: 100_000,
    logRetentionDays: 30,
    auditLogRetentionDays: 30,
    approvalWorkflows: true,
    incidentManagement: false,
    serviceCatalog: false,
    pipelines: false,
    aiCodingLoop: false,
    sso: false,
    advancedRbac: false,
    customConnectors: false,
    privateDeployment: false,
    supportLevel: "community",
    overagePolicy: "hard_stop",
    overageInputCentsPerMillion: null,
    overageOutputCentsPerMillion: null,
  },
};

const GROWTH: PricingPlan = {
  tier: "growth",
  displayName: "Growth",
  tagline: "For growing engineering teams.",
  monthlyPriceCents: 79900,    // $799/mo
  annualPriceCents: 767040,    // 20% off annual
  highlights: [
    "15 users · 3 workspaces",
    "10 connectors · 3 cloud accounts · 3 desktop agents",
    "All 25 AI engineers · pipelines · approvals",
    "$200 AI credits/month",
    "2,000 agent runs · 500 automation runs · 100 cloud scans",
    "90-day logs · standard support",
    "Soft warning at 80%, overage billed at retail rates",
  ],
  entitlements: {
    maxUsers: 15,
    maxWorkspaces: 3,
    maxConnectors: 10,
    maxCloudAccounts: 3,
    maxRepositories: 30,
    maxDesktopAgents: 3,
    maxAgentsEnabled: 25,
    includedAICreditsCents: 20_000,      // $200
    includedAIInputTokens: 50_000_000,
    includedAIOutputTokens: 5_000_000,
    monthlyAgentRuns: 2_000,
    monthlyAutomationRuns: 500,
    monthlyConnectorSyncs: 15_000,
    monthlyCloudScans: 100,
    monthlySecurityScans: 100,
    monthlyReports: 50,
    monthlyPdfExports: 100,
    monitoringEventsPerMonth: 1_000_000,
    logRetentionDays: 90,
    auditLogRetentionDays: 90,
    approvalWorkflows: true,
    incidentManagement: true,
    serviceCatalog: false,
    pipelines: true,
    aiCodingLoop: true,
    sso: false,
    advancedRbac: false,
    customConnectors: false,
    privateDeployment: false,
    supportLevel: "standard",
    overagePolicy: "metered_billing",
    overageInputCentsPerMillion: 600,    // 2x Sonnet 4.6 input (retail markup)
    overageOutputCentsPerMillion: 3000,  // 2x Sonnet 4.6 output
  },
};

const BUSINESS: PricingPlan = {
  tier: "business",
  displayName: "Business",
  tagline: "For serious engineering organizations.",
  monthlyPriceCents: 249900,   // $2,499/mo
  annualPriceCents: 2399040,   // 20% off
  highlights: [
    "50 users · 10 workspaces",
    "30 connectors · 10 cloud accounts · 15 desktop agents",
    "Everything in Growth + service catalog + advanced RBAC",
    "$750 AI credits/month",
    "10,000 agent runs · 2,500 automation runs · 500 cloud scans",
    "365-day logs · priority support",
    "Overage billed automatically",
  ],
  entitlements: {
    maxUsers: 50,
    maxWorkspaces: 10,
    maxConnectors: 30,
    maxCloudAccounts: 10,
    maxRepositories: 200,
    maxDesktopAgents: 15,
    maxAgentsEnabled: 25,
    includedAICreditsCents: 75_000,      // $750
    includedAIInputTokens: 200_000_000,
    includedAIOutputTokens: 20_000_000,
    monthlyAgentRuns: 10_000,
    monthlyAutomationRuns: 2_500,
    monthlyConnectorSyncs: 60_000,
    monthlyCloudScans: 500,
    monthlySecurityScans: 500,
    monthlyReports: 250,
    monthlyPdfExports: 500,
    monitoringEventsPerMonth: 10_000_000,
    logRetentionDays: 365,
    auditLogRetentionDays: 365,
    approvalWorkflows: true,
    incidentManagement: true,
    serviceCatalog: true,
    pipelines: true,
    aiCodingLoop: true,
    sso: true,
    advancedRbac: true,
    customConnectors: false,
    privateDeployment: false,
    supportLevel: "priority",
    overagePolicy: "metered_billing",
    overageInputCentsPerMillion: 500,
    overageOutputCentsPerMillion: 2500,
  },
};

const ENTERPRISE: PricingPlan = {
  tier: "enterprise",
  displayName: "Enterprise",
  tagline: "Custom AI usage pool, SSO/SAML, dedicated support.",
  monthlyPriceCents: null,     // contact us
  annualPriceCents: null,
  highlights: [
    "Negotiated seats · unlimited workspaces",
    "Custom AI token pool · provider routing",
    "SSO/SAML · advanced RBAC · custom connectors",
    "Dedicated success engineer · legal/compliance review",
    "Private deployment options · custom DPA",
    "Custom contract terms for overage",
  ],
  entitlements: {
    maxUsers: null,
    maxWorkspaces: null,
    maxConnectors: null,
    maxCloudAccounts: null,
    maxRepositories: null,
    maxDesktopAgents: null,
    maxAgentsEnabled: null,
    includedAICreditsCents: 500_000,     // $5,000 baseline; negotiated
    includedAIInputTokens: 1_500_000_000,
    includedAIOutputTokens: 150_000_000,
    monthlyAgentRuns: null,
    monthlyAutomationRuns: null,
    monthlyConnectorSyncs: null,
    monthlyCloudScans: null,
    monthlySecurityScans: null,
    monthlyReports: null,
    monthlyPdfExports: null,
    monitoringEventsPerMonth: null,
    logRetentionDays: 730,
    auditLogRetentionDays: 2555,         // 7 years for compliance
    approvalWorkflows: true,
    incidentManagement: true,
    serviceCatalog: true,
    pipelines: true,
    aiCodingLoop: true,
    sso: true,
    advancedRbac: true,
    customConnectors: true,
    privateDeployment: true,
    supportLevel: "dedicated",
    overagePolicy: "custom_contract",
    overageInputCentsPerMillion: null,
    overageOutputCentsPerMillion: null,
  },
};

export const PLAN_REGISTRY: ReadonlyArray<PricingPlan> = [STARTER, GROWTH, BUSINESS, ENTERPRISE];

export function findPlan(tier: PlanTier): PricingPlan {
  const plan = PLAN_REGISTRY.find((p) => p.tier === tier);
  if (!plan) throw new Error(`Unknown plan tier: ${tier}`);
  return plan;
}

/**
 * Map a legacy Stripe-tier string ("trial" | "starter" | "growth" | "enterprise")
 * to the new plan registry. Trial maps to Starter for entitlement purposes.
 * Existing TenantBillingPlan rows continue to work unchanged.
 */
export function planForStripeTier(stripeTier: string | null | undefined): PricingPlan {
  switch (stripeTier) {
    case "starter":    return STARTER;
    case "growth":     return GROWTH;
    case "business":   return BUSINESS;
    case "enterprise": return ENTERPRISE;
    // Legacy: "trial" mapped to Starter entitlements until subscriptions migrate.
    case "trial":      return STARTER;
    default:           return STARTER;
  }
}
