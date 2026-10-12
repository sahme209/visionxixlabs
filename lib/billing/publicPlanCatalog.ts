export type PublicPlanId = "free" | "pro" | "enterprise";
export type PaidPublicPlanId = Exclude<PublicPlanId, "free">;
export type BillingInterval = "monthly" | "annual";

export interface PublicPlan {
  id: PublicPlanId;
  name: string;
  description: string;
  monthlyPricePerUserCents: number;
  annualPricePerUserCents: number;
  includedSeats: number | null;
  monthlyDeployments: number | null;
  monthlyAiCreditCents: number;
  aiCreditBasis: "organization" | "paid_seat";
  highlights: readonly string[];
}

/**
 * Proposed customer-facing catalog. It is intentionally separate from legacy
 * Stripe identifiers until organization billing, quotas, and webhooks all use
 * the same authority. No checkout endpoint may infer activation from this file.
 */
export const PUBLIC_PLAN_CATALOG: readonly PublicPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "For an individual or small team proving the workflow.",
    monthlyPricePerUserCents: 0,
    annualPricePerUserCents: 0,
    includedSeats: 2,
    monthlyDeployments: 10,
    monthlyAiCreditCents: 200,
    aiCreditBasis: "organization",
    highlights: [
      "2 organization members",
      "10 counted deployments each month",
      "$2 of governed AI usage each month",
      "Essential integrations and basic automation",
      "Approval gates and audit history included",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For teams running governed delivery every week.",
    monthlyPricePerUserCents: 2_900,
    annualPricePerUserCents: 2_320,
    includedSeats: null,
    monthlyDeployments: 100,
    monthlyAiCreditCents: 1_000,
    aiCreditBasis: "paid_seat",
    highlights: [
      "100 counted deployments each month",
      "$10 of governed AI usage per paid seat",
      "Advanced workflows and scheduling",
      "Higher automation allowances",
      "Save 20% with annual billing",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For larger organizations standardizing governed delivery.",
    monthlyPricePerUserCents: 7_900,
    annualPricePerUserCents: 6_320,
    includedSeats: null,
    monthlyDeployments: 500,
    monthlyAiCreditCents: 3_000,
    aiCreditBasis: "paid_seat",
    highlights: [
      "500 counted deployments each month",
      "$30 of governed AI usage per paid seat",
      "Advanced workspace policy and administration",
      "Save 20% with annual billing",
    ],
  },
] as const;

/**
 * A deployment counts once when Axiom successfully dispatches an approved
 * deployment workflow for an environment. Validation retries, status polling,
 * and automatic rollback of that same dispatch do not create another count.
 * A rejected, canceled, or failed-to-dispatch proposal never counts.
 */
export const COUNTED_DEPLOYMENT_DEFINITION =
  "One successfully dispatched approved deployment workflow for one environment.";

const PUBLIC_PLAN_IDS = new Set<string>(PUBLIC_PLAN_CATALOG.map((plan) => plan.id));

export function isPublicPlanId(value: string): value is PublicPlanId {
  return PUBLIC_PLAN_IDS.has(value);
}

export function isPaidPublicPlanId(value: string): value is PaidPublicPlanId {
  return value === "pro" || value === "enterprise";
}

export function isBillingInterval(value: string): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

export function stripePriceEnvKey(planId: PaidPublicPlanId, interval: BillingInterval): string {
  return `STRIPE_PRICE_${planId.toUpperCase()}_${interval.toUpperCase()}`;
}

/**
 * Temporary compatibility mapping for the existing TenantBillingPlan store.
 * Public checkout and Stripe metadata use only Free/Pro/Enterprise. The
 * legacy entitlement engine still calls its Pro-equivalent tier `growth`;
 * this explicit boundary can be removed with the later database migration.
 */
export function legacyEntitlementTierForPublicPlan(planId: PaidPublicPlanId): "growth" | "enterprise" {
  return planId === "pro" ? "growth" : "enterprise";
}

export function isSelfServiceBillingEnabled(): boolean {
  return process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED === "true";
}
