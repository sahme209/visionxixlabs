import { describe, expect, it } from "vitest";
import { actualGeneratedPrismaSchema } from '@/lib/database/__tests__/fixtures/generatedPrismaModel';
const names = ["User", "OrgMembership", "TenantBillingPlan", "StripeBillingEvent", "UsageEvent", "AIUsageReservation", "AddOnPurchase", "OrganizationAIProviderPolicy", "SecureAuditRecord"];
const schema = names.map(name => `model ${name} {\n  id String @id\n  note String @default("a  b")\n  org String\n  @@unique([org, id])\n}`).join("\n");
describe("used generated schema qualifications do not forgive semantic drift", () => {
  it("accepts formatting/index placement changes while checking every actual model independently", async () => {
    const b = await import("./fixtures/ownedCheckoutWorkerBundle");
    expect(b.ownedGeneratedModelFacts(schema, schema.replaceAll("  id String", "    id    String")).map(r => r.name)).toEqual(names);
    expect(() => b.ownedGeneratedModelFacts(schema, schema.replace('model User {', 'model MissingUser {'))).toThrow("owned_checkout_closure_invalid");
  });
  it("preserves quoted values, field types and unique-index column ordering", async () => {
    const b = await import("./fixtures/ownedCheckoutWorkerBundle");
    for (const drift of [schema.replace('"a  b"', '"a b"'), schema.replace('org String', 'org String?'), schema.replace('@@unique([org, id])', '@@unique([id, org])')]) expect(() => b.ownedGeneratedModelFacts(schema, drift)).toThrow("owned_checkout_closure_invalid");
  });
  it("checks the actual read-only generated cache against all used/conservative source models without generation", async () => {
    const b = await import("./fixtures/ownedCheckoutWorkerBundle"), { readFileSync } = await import("node:fs");
    expect(b.ownedGeneratedModelFacts(readFileSync("prisma/schema.prisma", "utf8"), await actualGeneratedPrismaSchema()).map(r => r.name)).toEqual(names);
  });

});
