import { describe, expect, it, vi } from "vitest";
import { inspectAuthRecovery } from "../../scripts/auth-recovery-preflight.mjs";

function fixture(overrides: { readOnly?: string; users?: unknown[]; history?: unknown[]; duplicates?: unknown[] } = {}) {
  const statements: string[] = [];
  const tx = {
    $executeRawUnsafe: vi.fn(async (sql: string) => { statements.push(sql); return 0; }),
    $queryRaw: vi.fn(async (parts: TemplateStringsArray) => {
      const sql = parts.join("?");
      statements.push(sql);
      if (sql.includes("current_setting")) return [{ mode: overrides.readOnly ?? "on" }];
      if (sql.includes("pg_catalog.pg_tables")) return ["_prisma_migrations", "User", "OrgMembership", "TenantBillingPlan", "AddOnPurchase"].map((name) => ({ name }));
      if (sql.includes('FROM "_prisma_migrations"')) return overrides.history ?? [];
      if (sql.includes("information_schema.columns")) return [{ name: "id" }];
      if (sql.includes('FROM "User"')) return overrides.users ?? [{ id: "existing-user", normalized: true, password_present: true, email_verified: false }];
      if (sql.includes('FROM "OrgMembership"')) return [{ organizationId: "other-tenant", role: "read_only", accepted: true }];
      if (sql.includes('FROM "TenantBillingPlan"')) return [{ tier: "starter", status: "active" }];
      if (sql.includes('FROM "AddOnPurchase"')) return overrides.duplicates ?? [{ kind: "checkout_session", groups: 0 }, { kind: "payment_intent", groups: 0 }];
      throw new Error("unexpected query");
    }),
  };
  const client = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
  return { client, statements };
}

describe("read-only login recovery preflight", () => {
  it("refuses to inspect arbitrary accounts when no founder email is supplied", async () => {
    const { client } = fixture();
    await expect(inspectAuthRecovery(client)).rejects.toThrow("founder_email_required");
    expect(client.$transaction).not.toHaveBeenCalled();
  });
  it("refuses a transaction that is not read-only before reading user data", async () => {
    const { client, statements } = fixture({ readOnly: "off" });
    await expect(inspectAuthRecovery(client, { founderEmail: "founder@example.test" })).rejects.toThrow("read_only_transaction_required");
    expect(statements.some((sql) => sql.includes('FROM "User"'))).toBe(false);
  });
  it("exposes missing schema and pending migrations without granting personal or platform authority", async () => {
    const { client, statements } = fixture();
    const report = await inspectAuthRecovery(client, { founderEmail: " Founder@Example.Test " });
    expect(report.schema.verificationColumnPresent).toBe(false);
    expect(report.migrations.pending).toContain("20261014120000_add_email_verification");
    expect(report.migrations.pending).toContain("20261014190000_verified_ai_credit_fulfillment");
    expect(report.migrations.problems).toContain("missing_relation:20261013172000_add_workspace_agent_identity:Organization");
    expect(report.founder.canonicalUserId).toBe("existing-user");
    expect(report.founder.personalMembership).toBeNull();
    expect(report.founder.platformAdmin).toBe("configuration_unavailable");
    expect(report.productionApproval).toBe("not_requested");
    expect(statements[0]).toBe("SET TRANSACTION READ ONLY");
    expect(statements.every((sql) => /^(SET|\s*SELECT)/.test(sql))).toBe(true);
    expect(JSON.stringify(report)).not.toContain("founder@example.test");
  });
  it("reports ambiguous case variants without choosing an account or reading memberships", async () => {
    const { client, statements } = fixture({ users: [{ id: "one" }, { id: "two" }] });
    const report = await inspectAuthRecovery(client, { founderEmail: "founder@example.test" });
    expect(report.founder.match).toBe("ambiguous");
    expect(report.founder.canonicalUserId).toBeNull();
    expect(statements.some((sql) => sql.includes('FROM "OrgMembership"'))).toBe(false);
  });
  it("reports unresolved migrations and financial duplicates for review without repair", async () => {
    const { client } = fixture({
      history: [{ name: "failed-migration", finished: false, rolled_back: false }],
      duplicates: [{ kind: "checkout_session", groups: 2 }],
    });
    const report = await inspectAuthRecovery(client, { founderEmail: "founder@example.test", adminEmails: "someone-else@example.test" });
    expect(report.migrations.problems).toContain("unfinished:failed-migration");
    expect(report.billing.duplicateGroups).toContainEqual({ kind: "checkout_session", groups: 2 });
    expect(report.founder.platformAdmin).toBe(false);
  });
});
