export type PublicPlanId = "free" | "pro" | "business";

export interface PublicPlan {
  id: PublicPlanId;
  name: string;
  description: string;
  monthlyPricePerUserCents: number | null;
  annualPricePerUserCents: number | null;
  includedSeats: number | null;
  monthlyDeployments: number | null;
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
    highlights: [
      "2 organization members",
      "10 counted deployments each month",
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
    highlights: [
      "100 counted deployments each month",
      "Advanced workflows and scheduling",
      "Higher automation allowances",
      "20% annual discount when annual billing launches",
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "For organizations with custom volume and administration needs.",
    monthlyPricePerUserCents: null,
    annualPricePerUserCents: null,
    includedSeats: null,
    monthlyDeployments: null,
    highlights: [
      "Flexible deployment volume",
      "Advanced identity and administration",
      "Expanded integrations and support",
      "Contracted usage and retention terms",
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

export function isSelfServiceBillingEnabled(): boolean {
  return process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED === "true";
}

