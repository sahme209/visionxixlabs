import { expect, it } from "vitest";
import { validateSavedPlanFixtureTarget, validateSavedPlanFixtureExecutable } from "../../../scripts/fixtures/savedTerraformPlanFixture.mjs";
it("accepts only the parent's unique disposable loopback auth fixture", () => {
  expect(validateSavedPlanFixtureTarget("postgresql://fixture:synthetic@127.0.0.1:49123/axiom_auth_http_abcdef123456")).toContain("127.0.0.1");
  for (const value of ["postgresql://fixture@db.example/production", "postgresql://fixture@127.0.0.1:49123/production", "postgresql://fixture@127.0.0.1:49123/axiom_auth_http_abcdef123456?schema=public"]) expect(() => validateSavedPlanFixtureTarget(value)).toThrow();
});
it("refuses executable paths outside the downloaded owned fixture location", () => {
  expect(validateSavedPlanFixtureExecutable("/tmp/axiom-terraform-artifact-abcdef/bin/terraform")).toContain("/tmp/");
  for (const value of ["terraform", "/usr/bin/terraform", "/tmp/axiom-terraform-artifact-x/../other/terraform", "/tmp/axiom-terraform-artifact-x/bin/not-terraform"]) expect(() => validateSavedPlanFixtureExecutable(value)).toThrow();
});
