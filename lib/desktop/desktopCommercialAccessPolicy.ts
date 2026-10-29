export type DesktopCommercialAccessCode =
  | "active"
  | "production_access_required"
  | "payment_past_due"
  | "access_canceled";

export interface CommercialPlanSnapshot {
  tier: string;
  status: string;
  publicPlanId?: "free" | "pro" | "enterprise";
  pricingPlanAvailable?: boolean;
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
  if (plan.pricingPlanAvailable === false || (plan.publicPlanId && (plan.status !== "active" || plan.pricingPlanAvailable !== true))) {
    return {planTier:plan.publicPlanId ?? plan.tier,billingStatus:plan.status,accessRequestPath:"/control/usage-billing",pricingPath:"/plans",allowed:false,
      code:plan.status==="past_due"?"payment_past_due":plan.status==="canceled"?"access_canceled":"production_access_required",
      title:"Billing verification required",message:"This workspace's paid coverage could not be confirmed. Open Usage & billing to review or repair the subscription."};
  }
  // Pricing/entitlement enforcement is not active yet — signing in (identity
  // verification) is the only gate for now. This pure kernel is left in
  // place, with plan/status still threaded through, so the actual tiered
  // enforcement (pilot vs. paid vs. past-due) can be turned back on later
  // by restoring the branches below without touching any call site.
  return {
    planTier: plan.publicPlanId ?? plan.tier,
    billingStatus: plan.status,
    accessRequestPath: "/contact?topic=axiom-production-access",
    pricingPath: "/plans",
    allowed: true,
    code: "active",
    title: "Access active",
    message: "This workspace has access.",
  };
}
