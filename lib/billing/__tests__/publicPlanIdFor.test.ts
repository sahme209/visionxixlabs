import { expect, it } from "vitest";
import { publicPlanIdFor } from "../publicPlanCatalog";
it("maps stored plans to the public plan shown on Overview and Usage & billing", () => {
  expect(publicPlanIdFor("trial", "no_plan")).toBe("free");
  expect(publicPlanIdFor("growth", "active")).toBe("pro");
  expect(publicPlanIdFor("starter", "active")).toBe("pro");
  expect(publicPlanIdFor("enterprise", "active")).toBe("enterprise");
  expect(publicPlanIdFor("enterprise", "past_due")).toBe("free");
});
