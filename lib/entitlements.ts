/**
 * Single source of truth for feature access.
 * All entitlements derive from Stripe User.plan (starter | growth | scale | enterprise).
 * No User.modules dependency.
 */

import { getMembershipPlan } from "@/lib/pricing/membership";

export type StripePlan = "starter" | "growth" | "scale" | "enterprise";

export type OperatorTier = "free" | "pro" | "growth" | "enterprise";

export type CloudStudioTier = "free" | "professional" | "enterprise";

export type UnifiedTier = "free" | "pro" | "growth" | "enterprise";

export interface PlanEntitlements {
  /** Can use Website Builder */
  builder: boolean;
  /** Can use Axiom scan + view technical outputs (configs, roadmap) */
  axiomScan: boolean;
  /** Can run execution plugins and apply fixes */
  axiomExecution: boolean;
  /** Enterprise: full access, strategic advisory */
  fullAccess: boolean;
  /** Operator tier for cloud-operator/axiom flows */
  operatorTier: OperatorTier;
  /** Cloud Studio tier */
  studioTier: CloudStudioTier;
  /** Alias for axiomScan — can view technical outputs */
  canViewTechnicalOutputs: boolean;
  /** Can download configs/artifacts */
  canDownloadConfigs: boolean;
  /** Can view full Cloud Studio output */
  canViewFullOutput: boolean;
  /** Can download Cloud Studio artifacts */
  canDownload: boolean;
  /** Drift detection, continuous reassessment */
  hasContinuousReassessment: boolean;
  /** Enterprise engagement (board deck, strategic brief, etc.) */
  hasEnterpriseEngagement: boolean;
  /** Cloud connectors (AWS, Azure, GCP) — growth+ */
  cloudConnectors: boolean;
  /** Autonomous remediation (GitHub PR) — growth+ */
  remediationEnabled: boolean;
}

const PLAN_TO_OPERATOR: Record<string, OperatorTier> = {
  starter: "free",
  growth: "pro",
  scale: "growth",
  enterprise: "enterprise",
};

const PLAN_TO_STUDIO: Record<string, CloudStudioTier> = {
  starter: "free",
  growth: "professional",
  scale: "professional",
  enterprise: "enterprise",
};

/**
 * Derive all entitlements from Stripe User.plan.
 * Use this for execution, connectors, and any feature gating.
 */
export function getEntitlementsFromPlan(plan: string | null | undefined): PlanEntitlements {
  const p = (plan ?? "starter").toLowerCase() as StripePlan;
  const membership = getMembershipPlan(plan);
  const operatorTier = (PLAN_TO_OPERATOR[p] ?? membership.axiom.tier) as OperatorTier;
  const studioTier = (PLAN_TO_STUDIO[p] ?? membership.cloudStudio.tier) as CloudStudioTier;

  const axiomScan = operatorTier === "pro" || operatorTier === "growth" || operatorTier === "enterprise";
  const axiomExecution = operatorTier === "growth" || operatorTier === "enterprise";
  const fullAccess = operatorTier === "enterprise";

  return {
    builder: true, // all plans include builder
    axiomScan,
    axiomExecution,
    fullAccess,
    operatorTier,
    studioTier,
    canViewTechnicalOutputs: axiomScan,
    canDownloadConfigs: axiomScan,
    canViewFullOutput: studioTier === "professional" || studioTier === "enterprise",
    canDownload: studioTier === "professional" || studioTier === "enterprise",
    hasContinuousReassessment: operatorTier === "growth" || operatorTier === "enterprise",
    hasEnterpriseEngagement: operatorTier === "enterprise",
    cloudConnectors: membership.automation.cloudConnectors,
    remediationEnabled: membership.automation.remediationEnabled,
  };
}

/** Resolve raw tier string (from payload) to OperatorTier */
export function resolveOperatorTier(raw: string | null | undefined): OperatorTier {
  const value = (raw ?? "").toLowerCase();
  if (value === "pro" || value === "professional") return "pro";
  if (value === "growth") return "growth";
  if (value === "enterprise") return "enterprise";
  return "free";
}

/**
 * Resolve effective Operator tier for a lead.
 * If user has plan (Stripe), use that. Else use payload.tier from form.
 */
export function resolveEffectiveOperatorTier(
  payloadTier: string | null | undefined,
  userPlan: string | null | undefined
): OperatorTier {
  if (userPlan) {
    return getEntitlementsFromPlan(userPlan).operatorTier;
  }
  return resolveOperatorTier(payloadTier);
}

/** Tier-based capability checks (for existing callers that pass tier, not plan) */
export function canViewTechnicalOutputs(tier: OperatorTier): boolean {
  return tier === "pro" || tier === "growth" || tier === "enterprise";
}

/** Free tier can connect 1 cloud + validate + run analysis. Paid tiers unlock execution. */
export function canConnectCloud(tier: OperatorTier): boolean {
  return true;
}

export function canDownloadConfigs(tier: OperatorTier): boolean {
  return tier === "pro" || tier === "growth" || tier === "enterprise";
}

export function hasContinuousReassessment(tier: OperatorTier): boolean {
  return tier === "growth" || tier === "enterprise";
}

export function hasEnterpriseEngagement(tier: OperatorTier): boolean {
  return tier === "enterprise";
}

/** Cloud Studio tier checks */
export function canViewFullOutput(tier: CloudStudioTier): boolean {
  return tier === "professional" || tier === "enterprise";
}

export function canDownload(tier: CloudStudioTier): boolean {
  return tier === "professional" || tier === "enterprise";
}

export function isFreeTier(tier: CloudStudioTier): boolean {
  return tier === "free";
}

/** Unified tier for internal gating */
export function operatorTierToUnified(tier: string | null | undefined): UnifiedTier {
  const t = (tier ?? "").toLowerCase();
  if (t === "pro" || t === "professional") return "pro";
  if (t === "growth") return "growth";
  if (t === "enterprise") return "enterprise";
  return "free";
}

export function cloudStudioTierToUnified(tier: string | null | undefined): UnifiedTier {
  const t = (tier ?? "").toLowerCase();
  if (t === "professional" || t === "pro") return "pro";
  if (t === "enterprise") return "enterprise";
  return "free";
}

export function userPlanToUnified(plan: string | null | undefined): UnifiedTier {
  return getEntitlementsFromPlan(plan).operatorTier as UnifiedTier;
}

export function websiteBuilderTierToUnified(tier: string | null | undefined): UnifiedTier {
  const t = (tier ?? "").toLowerCase();
  if (t === "growth") return "growth";
  if (t === "scale" || t === "enterprise" || t === "done_for_you" || t === "doneforyou") return "enterprise";
  if (t === "professional" || t === "pro") return "growth";
  return "free";
}

/** Check if plan meets minimum required tier for execution */
export function planMeetsMinimum(plan: string | null | undefined, required: string): boolean {
  const tiers: string[] = ["starter", "growth", "scale", "enterprise"];
  const planIdx = tiers.indexOf((plan ?? "starter").toLowerCase());
  const requiredIdx = tiers.indexOf(required.toLowerCase());
  if (requiredIdx < 0) return true;
  return planIdx >= requiredIdx;
}

/** Stripe price ID → UnifiedTier (uses STRIPE_PRICES_* env) */
export function stripePriceToUnified(priceId: string | null | undefined): UnifiedTier {
  if (!priceId) return "free";
  const starter = (process.env.STRIPE_PRICES_STARTER ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const growth = (process.env.STRIPE_PRICES_GROWTH ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const scale = (process.env.STRIPE_PRICES_SCALE ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (starter.includes(priceId)) return "free";
  if (growth.includes(priceId)) return "growth";
  if (scale.includes(priceId)) return "enterprise";
  return "free";
}

/** Resolve unified tier for a lead with optional roadmap unlock override */
export function resolveUnifiedTierForLead(
  rawTier: string | null | undefined,
  fullPayload: { unlock?: { type?: string; paid?: boolean; expiresAt?: string } } | null | undefined
): UnifiedTier {
  const base = operatorTierToUnified(rawTier);
  if (base !== "free") return base;
  const unlock = fullPayload?.unlock;
  if (
    unlock?.type === "roadmap" &&
    unlock?.paid === true &&
    unlock?.expiresAt &&
    new Date(unlock.expiresAt) > new Date()
  ) {
    return "pro";
  }
  return "free";
}
