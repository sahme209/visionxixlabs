/**
 * Master Structural Stabilization: Canonical tier enum.
 * All gating logic should resolve via UnifiedTier internally.
 * Public tier labels remain unchanged.
 */

import { membershipToOperatorTier } from "./membership";

export type UnifiedTier = "free" | "pro" | "growth" | "enterprise";

/** User.plan from Stripe (starter | growth | scale | enterprise) → UnifiedTier */
export function userPlanToUnified(plan: string | null | undefined): UnifiedTier {
  return membershipToOperatorTier(plan) as UnifiedTier;
}

/** Website Builder tiers (starter | growth | scale | enterprise) — unified membership */
export function websiteBuilderTierToUnified(tier: string | null | undefined): UnifiedTier {
  const t = (tier ?? "").toLowerCase();
  if (t === "growth") return "growth";
  if (t === "scale" || t === "enterprise" || t === "done_for_you" || t === "doneforyou") return "enterprise";
  if (t === "professional" || t === "pro") return "growth"; // legacy
  return "free"; // starter
}

/** Cloud Studio tiers (free | professional | enterprise) */
export function cloudStudioTierToUnified(tier: string | null | undefined): UnifiedTier {
  const t = (tier ?? "").toLowerCase();
  if (t === "professional" || t === "pro") return "pro";
  if (t === "enterprise") return "enterprise";
  return "free";
}

/** Operator tiers (free | pro | growth | enterprise) - already aligned */
export function operatorTierToUnified(tier: string | null | undefined): UnifiedTier {
  const t = (tier ?? "").toLowerCase();
  if (t === "pro" || t === "professional") return "pro";
  if (t === "growth") return "growth";
  if (t === "enterprise") return "enterprise";
  return "free";
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

/**
 * Resolve unified tier for a lead with optional roadmap unlock override.
 * If fullPayload.unlock is valid (type=roadmap, paid, not expired), treat as "pro".
 */
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
