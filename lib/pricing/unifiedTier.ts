/**
 * Master Structural Stabilization: Canonical tier enum.
 * All gating logic should resolve via UnifiedTier internally.
 * Public tier labels remain unchanged.
 */

export type UnifiedTier = "free" | "pro" | "growth" | "enterprise";

/** User.plan from Stripe (starter | growth | scale) */
export function userPlanToUnified(plan: string | null | undefined): UnifiedTier {
  const p = (plan ?? "").toLowerCase();
  if (p === "growth") return "growth";
  if (p === "scale") return "enterprise";
  return "free";
}

/** Website Builder tiers (starter | professional | enterprise) */
export function websiteBuilderTierToUnified(tier: string | null | undefined): UnifiedTier {
  const t = (tier ?? "").toLowerCase();
  if (t === "professional" || t === "pro") return "pro";
  if (t === "enterprise" || t === "done_for_you" || t === "doneforyou") return "enterprise";
  return "free";
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
