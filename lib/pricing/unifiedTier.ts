/**
 * Re-exports from entitlements — single source of truth.
 * @deprecated Prefer importing from @/lib/entitlements directly.
 */

export {
  userPlanToUnified,
  websiteBuilderTierToUnified,
  cloudStudioTierToUnified,
  operatorTierToUnified,
  stripePriceToUnified,
  resolveUnifiedTierForLead,
} from "@/lib/entitlements";

export type { UnifiedTier } from "@/lib/entitlements";
