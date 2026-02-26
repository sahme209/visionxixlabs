/**
 * Phase 6: Canonical Product Tier Dictionary.
 * Unifies Cloud Studio, Operator, and Website Builder tiers into consistent labels.
 * Server-side gating (cloudOperator/pricing, etc.) remains the source of truth.
 */

export type ProductSource = "cloud-operator" | "cloud-studio" | "website-builder";

/** Unified tier labels for UI copy. Do not change internal enums. */
export const UNIFIED_TIER_LABELS: Record<string, string> = {
  free: "Analysis",
  pro: "Roadmap",
  professional: "Roadmap",
  growth: "Automation Signals",
  enterprise: "Strategic Advisory",
  starter: "Analysis",
  doneForYou: "Strategic Advisory",
  done_for_you: "Strategic Advisory",
};

/** Unified benefits by tier label (for upsell copy) */
export const UNIFIED_TIER_BENEFITS: Record<string, string[]> = {
  Analysis: [
    "Infrastructure scores and summary dashboard",
    "Executive summary",
    "No configs or technical outputs",
  ],
  Roadmap: [
    "Full 30-day optimization plan",
    "CI/CD YAML, Dockerfile, Terraform templates",
    "Cost breakdown, savings estimates",
    "Security hardening recommendations",
  ],
  "Automation Signals": [
    "Everything in Roadmap",
    "Drift detection and trend history",
    "Continuous reassessment",
  ],
  "Strategic Advisory": [
    "Everything in Automation Signals",
    "Policy packs, enterprise brief",
    "Strategic engagement and implementation support",
  ],
};

/** Upgrade path: suggested next tier from current */
export const UPGRADE_PATHS: Record<string, string | null> = {
  free: "pro",
  starter: "professional",
  professional: "growth",
  pro: "growth",
  growth: "enterprise",
  enterprise: null,
  doneForYou: null,
  done_for_you: null,
};

/**
 * Get unified tier label for display.
 */
export function getUnifiedTierLabel(
  source: ProductSource,
  tier: string | null | undefined
): string {
  const normalized = normalizeTierForSource(source, tier);
  return UNIFIED_TIER_LABELS[normalized] ?? "Analysis";
}

/**
 * Get unified benefits for the tier.
 */
export function getUnifiedTierBenefits(
  source: ProductSource,
  tier: string | null | undefined
): string[] {
  const label = getUnifiedTierLabel(source, tier);
  return UNIFIED_TIER_BENEFITS[label] ?? UNIFIED_TIER_BENEFITS.Analysis;
}

/**
 * Get suggested upgrade path (internal tier id, not label).
 */
export function getUpgradePath(
  source: ProductSource,
  tier: string | null | undefined
): string | null {
  const normalized = normalizeTierForSource(source, tier);
  return UPGRADE_PATHS[normalized] ?? null;
}

/**
 * Map source-specific tier to canonical operator-equivalent.
 */
function normalizeTierForSource(source: ProductSource, tier: string | null | undefined): string {
  const t = (tier ?? "free").toLowerCase().replace(/-/g, "");
  if (source === "cloud-operator") {
    if (t === "pro" || t === "professional") return "pro";
    if (t === "growth" || t === "automationsignals") return "growth";
    if (t === "enterprise" || t === "strategicadvisory") return "enterprise";
    return "free";
  }
  if (source === "cloud-studio") {
    if (t === "professional") return "professional";
    if (t === "enterprise") return "enterprise";
    return "free";
  }
  if (source === "website-builder") {
    if (t === "professional" || t === "pro") return "professional";
    if (t === "enterprise" || t === "doneforyou" || t === "done_for_you") return "doneForYou";
    return "starter";
  }
  return "free";
}
