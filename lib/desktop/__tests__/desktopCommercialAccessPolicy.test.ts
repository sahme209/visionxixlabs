import { describe, expect, it } from "vitest";
import { decideDesktopCommercialAccess } from "../desktopCommercialAccessPolicy";

describe("desktop commercial access policy", () => {
  it.each(["starter", "growth", "enterprise"])("allows an active paid %s workspace", (tier) => {
    expect(decideDesktopCommercialAccess({ tier, status: "active" })).toMatchObject({ allowed: true, code: "active" });
  });

  it.each([
    [{ tier: "trial", status: "active" }, "production_access_required"],
    [{ tier: "trial", status: "trialing" }, "production_access_required"],
    [{ tier: "starter", status: "no_plan" }, "production_access_required"],
    [{ tier: "growth", status: "past_due" }, "payment_past_due"],
    [{ tier: "enterprise", status: "canceled" }, "access_canceled"],
  ])("blocks an unentitled workspace %#", (plan, expectedCode) => {
    expect(decideDesktopCommercialAccess(plan)).toMatchObject({ allowed: false, code: expectedCode });
  });
});
