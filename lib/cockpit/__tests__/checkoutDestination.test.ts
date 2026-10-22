import { describe, expect, it } from "vitest";
import { publicPlanSelectionPath, publicPlanSignInPath } from "@/lib/billing/planSelection";

describe("cockpit checkout navigation", () => {
  it.each(["pro", "enterprise"] as const)("returns %s annual selection into authenticated plan review", planId => {
    const selection = { planId, billingInterval: "annual" as const };
    expect(publicPlanSelectionPath(selection)).toBe(`/control/plans?plan=${planId}&interval=annual`);
    const signin = new URL(publicPlanSignInPath(selection), "https://visionxixlabs.com");
    expect(signin.pathname).toBe("/auth/signin");
    expect(signin.searchParams.get("callbackUrl")).toBe(`/control/plans?plan=${planId}&interval=annual`);
  });
});

it("keeps the existing isolated owned TEST checkout inside its restricted allowlist",()=>{
 expect(new URL(publicPlanSignInPath({planId:"pro",billingInterval:"annual"},true), "https://visionxixlabs.com").searchParams.get("callbackUrl")).toBe("/plans?plan=pro&interval=annual");
});
