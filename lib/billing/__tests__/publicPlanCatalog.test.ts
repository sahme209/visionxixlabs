import { afterEach, describe, expect, it } from "vitest";
import {
  COUNTED_DEPLOYMENT_DEFINITION,
  PUBLIC_PLAN_CATALOG,
  isSelfServiceBillingEnabled,
} from "@/lib/billing/publicPlanCatalog";

describe("publicPlanCatalog", () => {
  const originalFlag = process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
    else process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED = originalFlag;
  });

  it("keeps security controls outside paid entitlements", () => {
    const free = PUBLIC_PLAN_CATALOG.find((plan) => plan.id === "free");
    expect(free?.includedSeats).toBe(2);
    expect(free?.monthlyDeployments).toBe(10);
    expect(free?.highlights.join(" ")).toContain("Approval gates");
  });

  it("prices Pro at $29 monthly and $23.20 annual equivalent", () => {
    const pro = PUBLIC_PLAN_CATALOG.find((plan) => plan.id === "pro");
    expect(pro?.monthlyPricePerUserCents).toBe(2_900);
    expect(pro?.annualPricePerUserCents).toBe(2_320);
    expect(pro?.monthlyDeployments).toBe(100);
  });

  it("keeps checkout disabled unless explicitly activated", () => {
    delete process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED;
    expect(isSelfServiceBillingEnabled()).toBe(false);
    process.env.AXIOM_SELF_SERVICE_BILLING_ENABLED = "true";
    expect(isSelfServiceBillingEnabled()).toBe(true);
  });

  it("defines a counted deployment without counting retries", () => {
    expect(COUNTED_DEPLOYMENT_DEFINITION).toContain("successfully dispatched");
  });
});

