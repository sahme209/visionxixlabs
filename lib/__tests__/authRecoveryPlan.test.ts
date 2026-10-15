import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateRehearsalTarget } from "../../scripts/rehearse-auth-recovery.mjs";

describe("reviewed authentication-only recovery boundary", () => {
  it.each([
    undefined, "", "postgresql://db.example.com/axiom_auth_recovery_rehearsal",
    "postgresql://127.0.0.1/production", "postgresql://localhost/axiom_auth_recovery_rehearsal",
    "postgresql://127.0.0.1/axiom_auth_recovery_rehearsal?schema=other", "file:/tmp/database",
  ])("refuses an unapproved rehearsal target: %s", value => {
    expect(() => validateRehearsalTarget(value)).toThrow("isolated_rehearsal_target_required");
  });
  it("accepts only the explicitly named loopback fixture", () => {
    expect(validateRehearsalTarget("postgresql://postgres:fixture@127.0.0.1:5432/axiom_auth_recovery_rehearsal")).toContain("/axiom_auth_recovery_rehearsal");
  });
  it("wraps the unchanged authentication migration and forbids unrelated data changes", () => {
    const original = readFileSync("prisma/migrations/20261014120000_add_email_verification/migration.sql", "utf8");
    const sql = readFileSync("ops/recovery/20261015_auth_schema_only.sql", "utf8");
    expect(createHash("sha256").update(original).digest("hex")).toBe("ad968345199bb9fa84add0340777631f99d5583aafe1949790051ccdf6d9873f");
    expect(createHash("sha256").update(readFileSync("prisma/migrations/20261013172000_add_workspace_agent_identity/migration.sql")).digest("hex")).toBe("761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7");
    expect(sql.split("-- BEGIN UNCHANGED AUTH MIGRATION\n")[1].split("\n-- END UNCHANGED AUTH MIGRATION")[0]).toBe(original);
    expect(sql).toContain("BEGIN;");
    expect(sql.trim()).toMatch(/COMMIT;$/);
    expect(sql).toContain("auth_recovery_schema_already_present_or_partial");
    expect(sql).toContain("auth_recovery_migration_state_changed");
    expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\s+(?:INTO|FROM|TABLE|INDEX|"_prisma_migrations")/i);
    expect(sql).not.toContain('CREATE TABLE "Organization"');
    expect(sql).not.toContain('CREATE TABLE "AIUsageBilling');
  });
});
