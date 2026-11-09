import { describe, expect, it } from "vitest";
import { previewImpact } from "../impactKernel";

describe("change impact preview kernel", () => {
  it("keeps a small app change with tests contained", () => {
    const r = previewImpact(["lib/billing/format.ts", "lib/billing/__tests__/format.test.ts"]);
    expect(r).toMatchObject({ files: 2, blastRadius: "contained", rollback: "likely_clean", testsTouched: true });
    expect(r.areas.map((a) => a.area)).toEqual(["tests", "application"]);
  });

  it("flags migrations as needing a rollback plan", () => {
    const r = previewImpact(["prisma/migrations/2026_add/migration.sql", "prisma/schema.prisma"]);
    expect(r.areas[0]).toEqual({ area: "database_migration", files: 2 });
    expect(r.rollback).toBe("needs_plan");
    expect(r.blastRadius).not.toBe("contained");
    expect(r.checks.join(" ")).toMatch(/backup/);
  });

  it("treats CI, auth, infra and secrets as sensitive and widens the blast radius", () => {
    const r = previewImpact([".github/workflows/deploy.yml", "lib/auth/session.ts", "infra/main.tf", ".env.production"]);
    expect(r.areas.map((a) => a.area)).toEqual(expect.arrayContaining(["ci_cd", "auth_security", "infrastructure", "secrets_config"]));
    expect(r.blastRadius).toBe("wide");
    expect(r.checks.some((c) => /secret/i.test(c))).toBe(true);
  });

  it("asks for tests when none changed", () => {
    expect(previewImpact(["lib/x.ts"]).checks).toContain("No test files changed. Ask for tests that cover the change.");
    expect(previewImpact(["README.md"]).checks).not.toContain("No test files changed. Ask for tests that cover the change.");
  });

  it("recognises dependency manifests across ecosystems", () => {
    for (const f of ["package.json", "services/api/requirements.txt", "go.mod", "Cargo.lock", "app/pom.xml"]) expect(previewImpact([f]).areas.map((a) => a.area)).toContain("dependencies");
  });

  it("de-duplicates, ignores junk and always states its limits", () => {
    const r = previewImpact(["./a.ts", "a.ts", "", "x".repeat(500)]);
    expect(r.files).toBe(1);
    expect(r.limits[0]).toMatch(/file paths only/);
  });
});
