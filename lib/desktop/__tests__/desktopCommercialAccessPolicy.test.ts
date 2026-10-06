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
