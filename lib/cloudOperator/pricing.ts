import type { OperatorTier } from "./types";
import { operatorTierToUnified, type UnifiedTier } from "@/lib/pricing/unifiedTier";

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

