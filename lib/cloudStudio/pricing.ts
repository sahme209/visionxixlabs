import type { CloudStudioTier } from "./types";

/**
 * Whether the current tier gets full output (vs limited summary).
 */
export function canViewFullOutput(tier: CloudStudioTier): boolean {
  return tier === "professional" || tier === "enterprise";
}

/**
 * Whether the current tier can download artifacts.
 */
export function canDownload(tier: CloudStudioTier): boolean {
  return tier === "professional" || tier === "enterprise";
}

/**
 * Enforce tier for generation: free gets summary-only prompt.
 */
export function isFreeTier(tier: CloudStudioTier): boolean {
  return tier === "free";
}
