/**
 * Axiom Cloud Operations Agent — separate product pricing (display only).
 * @deprecated Use MEMBERSHIP_PLANS from @/lib/pricing/membership for entitlements.
 * Display-only; UI still uses AXIOM_PLANS for /axiom/pricing page.
 * Track: axiom
 * Plans: Scan (analysis only), Agent (scan + reasoning + execution), Enterprise (full autonomous ops)
 */

export type AxiomPlanId = "cloud-basic" | "cloud-pro" | "enterprise";

export interface AxiomPlan {
  id: AxiomPlanId;
  name: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  description: string;
  popular?: boolean;
  features: string[];
  /** Has auto-fix execution */
  autoFix: boolean;
  /** Has AI Ops Assistant (chatbot module) */
  aiOpsAssistant: boolean;
}

export const AXIOM_PLANS: Record<AxiomPlanId, AxiomPlan> = {
  "cloud-basic": {
    id: "cloud-basic",
    name: "Scan",
    monthlyPrice: 49,
    yearlyPrice: 353,
    description: "Read-only analysis",
    popular: false,
    autoFix: false,
    aiOpsAssistant: false,
    features: [
      "Full infrastructure scan (AWS)",
      "Cost, security, and drift analysis",
      "Prioritized findings with severity",
      "30-day trend history",
      "Executive summary report",
      "1 cloud account",
    ],
  },
  "cloud-pro": {
    id: "cloud-pro",
    name: "Agent",
    monthlyPrice: 99,
    yearlyPrice: 714,
    description: "Scan + Reasoning + Execution",
    popular: true,
    autoFix: true,
    aiOpsAssistant: false,
    features: [
      "Everything in Scan",
      "Cognitive reasoning engine",
      "Phased execution plans with rollback",
      "Terraform and CLI code generation",
      "Governance policies and approval gates",
      "Up to 3 cloud accounts",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    yearlyPrice: null,
    description: "Full autonomous operations",
    popular: false,
    autoFix: true,
    aiOpsAssistant: true,
    features: [
      "Everything in Agent",
      "Autonomous operations with trust ladder",
      "Compliance frameworks (SOC2, GDPR, ISO 27001)",
      "Unlimited cloud accounts",
      "Dedicated success manager",
      "SLA guarantee",
    ],
  },
};
