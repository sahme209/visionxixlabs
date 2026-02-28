import type { OperatorTier } from "./types";
import { operatorTierToUnified, type UnifiedTier } from "@/lib/pricing/unifiedTier";
import { membershipToOperatorTier } from "@/lib/pricing/membership";

export function resolveOperatorTier(raw: string | null | undefined): OperatorTier {
  const value = (raw || "").toLowerCase();
  if (value === "pro" || value === "professional") return "pro";
  if (value === "growth") return "growth";
  if (value === "enterprise") return "enterprise";
  return "free";
}

export function canViewTechnicalOutputs(tier: OperatorTier): boolean {
  return tier === "pro" || tier === "growth" || tier === "enterprise";
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

/** Resolve Operator tier to UnifiedTier for internal gating */
export function toUnifiedTier(tier: OperatorTier | string | null | undefined): UnifiedTier {
  return operatorTierToUnified(tier);
}

/**
 * Resolve effective Operator tier for a lead.
 * If lead has userId and user has a membership plan, use membership tier (Growth+ = Pro+).
 * Otherwise use fullPayload.tier from form.
 */
export function resolveEffectiveOperatorTier(
  payloadTier: string | null | undefined,
  userPlan: string | null | undefined
): OperatorTier {
  if (userPlan) {
    return membershipToOperatorTier(userPlan) as OperatorTier;
  }
  return resolveOperatorTier(payloadTier);
}

