/**
 * Axiom Cloud Automation — separate product pricing.
 * Track: axiom
 * Plans: Cloud Basic (Scan only), Cloud Pro (Scan + Fix), Enterprise (Scan + Fix + AI Ops Assistant)
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
    name: "Cloud Basic",
    monthlyPrice: 49,
    yearlyPrice: 353,
    description: "Scan only",
    popular: false,
    autoFix: false,
    aiOpsAssistant: false,
    features: [
      "Cloud infrastructure scan",
      "Cost analysis report",
      "Security findings",
      "30-day trend history",
      "Executive summary",
      "1 cloud account",
    ],
  },
  "cloud-pro": {
    id: "cloud-pro",
    name: "Cloud Pro",
    monthlyPrice: 99,
    yearlyPrice: 714,
    description: "Scan + Fix",
    popular: true,
    autoFix: true,
    aiOpsAssistant: false,
    features: [
      "Everything in Cloud Basic",
      "Auto-fix execution (GitHub PR)",
      "CI/CD YAML, Terraform templates",
      "Cost optimization playbooks",
      "AWS, Azure, GCP connectors",
      "Up to 3 cloud accounts",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    yearlyPrice: null,
    description: "Scan + Fix + AI Ops Assistant",
    popular: false,
    autoFix: true,
    aiOpsAssistant: true,
    features: [
      "Everything in Cloud Pro",
      "AI Ops Assistant (chatbot)",
      "Strategic advisory",
      "Unlimited connectors",
      "Dedicated success manager",
      "SLA",
    ],
  },
};
