/**
 * Re-exports from entitlements — single source of truth.
 * @deprecated Prefer importing from @/lib/entitlements directly.
 */

import type { OperatorTier } from "./types";
import {
  resolveOperatorTier as resolve,
  canViewTechnicalOutputs,
  canDownloadConfigs,
  hasContinuousReassessment,
  hasEnterpriseEngagement,
  operatorTierToUnified,
} from "@/lib/entitlements";

export type { UnifiedTier } from "@/lib/entitlements";

export const resolveOperatorTier = resolve as (raw: string | null | undefined) => OperatorTier;
export { resolveEffectiveOperatorTier } from "@/lib/entitlements";
export { canViewTechnicalOutputs, canDownloadConfigs, hasContinuousReassessment, hasEnterpriseEngagement };

export function toUnifiedTier(tier: OperatorTier | string | null | undefined) {
  return operatorTierToUnified(tier);
}
