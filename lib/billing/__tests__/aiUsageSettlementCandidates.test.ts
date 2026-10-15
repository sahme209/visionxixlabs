import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { aiUsageSettlementCandidates } from "../aiUsageSettlementCandidates";

// Execute the generated ANSI SELECT against an isolated in-memory database.
// No external database or credentials are used. PostgreSQL compatibility is
// additionally checked with a disposable PostgreSQL fixture before merging.
const now = new Date("2026-10-15T12:00:00.000Z");
function select(limit: number, setup = ""): string[] {
  const query = aiUsageSettlementCandidates(limit, now);
  const script = `
import json, sqlite3, sys
query = json.loads(sys.argv[1])
db = sqlite3.connect(':memory:')
db.executescript('''
CREATE TABLE "UsageEvent" (id TEXT, organizationId TEXT, billedCents INTEGER, billingStatus TEXT, createdAt TEXT);
CREATE TABLE "AIUsageBillingSettlement" (usageEventId TEXT, status TEXT, organizationId TEXT, amountCents INTEGER, createdAt TEXT, updatedAt TEXT);
CREATE TABLE "AIUsageBillingConfig" (organizationId TEXT PRIMARY KEY, enabled BOOLEAN, monthlySpendLimitCents INTEGER);
CREATE TABLE "TenantBillingPlan" (organizationId TEXT PRIMARY KEY, stripeCustomerId TEXT);
CREATE TABLE "AIUsageBillingPeriod" (organizationId TEXT, periodMonth TEXT, reservedCents INTEGER);
INSERT INTO "AIUsageBillingConfig" VALUES ('org-1', true, 100), ('org-2', true, 1);
INSERT INTO "TenantBillingPlan" VALUES ('org-1', 'cus_test_1'), ('org-2', 'cus_test_2');
INSERT INTO "AIUsageBillingPeriod" VALUES ('org-2', '2026-10', 1);
INSERT INTO "UsageEvent" VALUES
 ('done', 'org-1', 3, 'settled', '2026-10-01'),
 ('retry', 'org-2', 4, 'settled', '2026-10-02'),
 ('new', 'org-1', 5, 'settled', '2026-10-15T11:30:00.000Z'),
 ('pending', 'org-1', 5, 'pending', '2026-09-01'),
 ('free', 'org-1', 0, 'settled', '2026-09-01');
INSERT INTO "AIUsageBillingSettlement" VALUES
 ('done', 'submitted', 'org-1', 3, '2026-10-15T11:00:00.000Z', '2026-10-15T11:00:00.000Z'),
 ('retry', 'reserved', 'org-2', 4, '2026-10-15T11:00:00.000Z', '2026-10-15T11:00:00.000Z');
''')
# Older held records must not fill the entire bounded batch. No hold is deleted.
for name, status, org, amount, created in [
 ('expired', 'reserved', 'org-1', 3, '2026-10-14T12:59:59.999Z'),
 ('boundary', 'reserved', 'org-1', 3, '2026-10-14T13:00:00.000Z'),
 ('future', 'reserved', 'org-1', 3, '2026-10-15T12:00:00.001Z'),
 ('failed', 'failed', 'org-1', 3, '2026-10-15T11:00:00.000Z'),
 ('blocked', 'blocked', 'org-1', 3, '2026-10-15T11:00:00.000Z'),
 ('unknown', 'unknown', 'org-1', 3, '2026-10-15T11:00:00.000Z'),
 ('wrong-tenant', 'reserved', 'org-other', 3, '2026-10-15T11:00:00.000Z'),
 ('wrong-amount', 'reserved', 'org-1', 999, '2026-10-15T11:00:00.000Z')]:
 db.execute('INSERT INTO "UsageEvent" VALUES (?, ?, ?, ?, ?)', (name, 'org-1', 3, 'settled', '2026-09-01'))
 db.execute('INSERT INTO "AIUsageBillingSettlement" VALUES (?, ?, ?, ?, ?, ?)', (name, status, org, amount, created, created))
for name, enabled, cap, customer, reserved in [
 ('disabled', False, 100, 'cus_test', 0),
 ('zero-cap', True, 0, 'cus_test', 0),
 ('missing-customer', True, 100, None, 0),
 ('blank-customer', True, 100, '  ', 0),
 ('exhausted', True, 100, 'cus_test', 100),
 ('negative-counter', True, 100, 'cus_test', -1),
 ('over-cap', True, 2, 'cus_test', 0)]:
 db.execute('INSERT INTO "UsageEvent" VALUES (?, ?, ?, ?, ?)', (name, name, 3, 'settled', '2026-09-01'))
 db.execute('INSERT INTO "AIUsageBillingConfig" VALUES (?, ?, ?)', (name, enabled, cap))
 db.execute('INSERT INTO "TenantBillingPlan" VALUES (?, ?)', (name, customer))
 db.execute('INSERT INTO "AIUsageBillingPeriod" VALUES (?, ?, ?)', (name, '2026-10', reserved))
db.executescript(query['setup'])
print(json.dumps([row[0] for row in db.execute(query['sql'], query['values'])]))
`;
  return JSON.parse(execFileSync("python3", ["-c", script, JSON.stringify({ sql: query.sql, values: query.values, setup })], { encoding: "utf8", timeout: 5000 }));
}

describe("AI settlement candidate selection", () => {
  it("lets a recent retry into a one-row batch despite an older submitted event", () => {
    expect(select(1)).toEqual(["retry"]);
  });
  it("includes new events and retries while excluding pending and zero-cost usage", () => {
    expect(select(100)).toEqual(["retry", "new"]);
  });
  it.each([[0, 1], [-1, 1], [1.9, 1], [501, 500], [NaN, 100], [Infinity, 100]])("bounds batch limit %s to %s", (input, expected) => {
    expect(aiUsageSettlementCandidates(input, now).values.at(-1)).toEqual(expected);
  });
  it("fails closed for an invalid selection clock", () => {
    expect(() => aiUsageSettlementCandidates(100, new Date(NaN))).toThrow("Invalid settlement selection time");
  });
  it("allows a new reservation exactly at remaining capacity", () => {
    expect(select(100, `INSERT INTO "AIUsageBillingPeriod" VALUES ('org-1', '2026-10', 95);`)).toEqual(["retry", "new"]);
  });
  it("does not select new usage above remaining capacity", () => {
    expect(select(100, `INSERT INTO "AIUsageBillingPeriod" VALUES ('org-1', '2026-10', 96);`)).toEqual(["retry"]);
  });
  it("ignores a previous month's reservation counter", () => {
    expect(select(100, `INSERT INTO "AIUsageBillingPeriod" VALUES ('org-1', '2026-09', 100);`)).toEqual(["retry", "new"]);
  });
  it("excludes missing opt-in configuration and missing billing plans", () => {
    expect(select(100, `DELETE FROM "AIUsageBillingConfig" WHERE "organizationId" = 'org-1'; DELETE FROM "TenantBillingPlan" WHERE "organizationId" = 'org-2';`)).toEqual([]);
  });
  it("keeps already-reserved retries eligible despite a spent cap", () => {
    expect(select(1)).toEqual(["retry"]);
  });
  it("rotates a recently attempted retry behind waiting new usage in a one-row batch", () => {
    expect(select(1, `UPDATE "AIUsageBillingSettlement" SET "updatedAt" = '2026-10-15T12:00:00.000Z' WHERE "usageEventId" = 'retry';`)).toEqual(["new"]);
  });
});
