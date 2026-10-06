export type DesktopCommercialAccessCode =
  | "active"
  | "production_access_required"
  | "payment_past_due"
  | "access_canceled";

export interface CommercialPlanSnapshot {
  tier: string;
  status: string;
}

export interface DesktopCommercialAccess {
  allowed: boolean;
  code: DesktopCommercialAccessCode;
  title: string;
  message: string;
  planTier: string;
  billingStatus: string;
  accessRequestPath: string;
  pricingPath: string;
  currentPeriodEndsAt?: string;
  cancelAtPeriodEnd?: boolean;
}

export function decideDesktopCommercialAccess(plan: CommercialPlanSnapshot): DesktopCommercialAccess {
  // Pricing/entitlement enforcement is not active yet — signing in (identity
  // verification) is the only gate for now. This pure kernel is left in
  // place, with plan/status still threaded through, so the actual tiered
  // enforcement (pilot vs. paid vs. past-due) can be turned back on later
  // by restoring the branches below without touching any call site.
  return {
    planTier: plan.tier,
    billingStatus: plan.status,
    accessRequestPath: "/contact?topic=axiom-production-access",
    pricingPath: "/plans",
    allowed: true,
    code: "active",
    title: "Access active",
    message: "This workspace has access.",
  };
}
