import { describe, expect, it } from "vitest";
import { decideDesktopCommercialAccess } from "../desktopCommercialAccessPolicy";

describe("desktop commercial access policy", () => {
  // Pricing/entitlement enforcement is not active yet — any verified
  // identity gets access, regardless of plan tier or billing status.
  it.each([
    { tier: "pilot", status: "active" },
    { tier: "starter", status: "active" },
    { tier: "trial", status: "trialing" },
    { tier: "trial", status: "no_plan" },
    { tier: "enterprise", status: "past_due" },
    { tier: "growth", status: "canceled" },
  ])("allows access for any plan/status %#", (plan) => {
    expect(decideDesktopCommercialAccess(plan)).toMatchObject({ allowed: true, code: "active" });
  });
});

// Public billing uses internal entitlement tiers; desktop account labels must
// retain the same public plan identity displayed in the cockpit.
describe("public desktop plan identity", () => {
  it.each([
    { tier: "starter", publicPlanId: "free" as const },
    { tier: "growth", publicPlanId: "pro" as const },
    { tier: "enterprise", publicPlanId: "enterprise" as const },
  ])("returns the verified $publicPlanId identity", (plan) => {
    expect(decideDesktopCommercialAccess({ ...plan, status: "active", pricingPlanAvailable: true }))
      .toMatchObject({ planTier: plan.publicPlanId, allowed: true, billingStatus: "active" });
  });
});
