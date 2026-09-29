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
  const shared = {
    planTier: plan.tier,
    billingStatus: plan.status,
    accessRequestPath: "/contact?topic=axiom-production-access",
    pricingPath: "/plans",
  };

  if (plan.status === "active" && plan.tier !== "trial") {
    return { ...shared, allowed: true, code: "active", title: "Production access active", message: "This workspace has an active commercial entitlement." };
  }
  if (plan.status === "past_due") {
    return { ...shared, allowed: false, code: "payment_past_due", title: "Payment action required", message: "Your identity is verified, but this workspace's production access is paused until its billing issue is resolved." };
  }
  if (plan.status === "canceled") {
    return { ...shared, allowed: false, code: "access_canceled", title: "Production access ended", message: "Your identity is verified, but this workspace no longer has an active commercial entitlement." };
  }
  return { ...shared, allowed: false, code: "production_access_required", title: "Production access required", message: "Your identity is verified. An approved paid workspace entitlement is required before operational data and deployment controls are available." };
}
