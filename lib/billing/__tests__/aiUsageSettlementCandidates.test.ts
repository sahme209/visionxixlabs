import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { aiUsageSettlementCandidates } from "../aiUsageSettlementCandidates";

// Execute the generated ANSI SELECT against an isolated in-memory database.
// No external database or credentials are used. PostgreSQL compatibility is
// additionally checked with a disposable PostgreSQL fixture before merging.
const now = new Date("2026-10-15T12:00:00.000Z");
function select(limit: number): string[] {
  const query = aiUsageSettlementCandidates(limit, now);
  const script = `
import json, sqlite3, sys
query = json.loads(sys.argv[1])
db = sqlite3.connect(':memory:')
db.executescript('''
CREATE TABLE "UsageEvent" (id TEXT, organizationId TEXT, billedCents INTEGER, billingStatus TEXT, createdAt TEXT);
CREATE TABLE "AIUsageBillingSettlement" (usageEventId TEXT, status TEXT, organizationId TEXT, amountCents INTEGER, createdAt TEXT);
INSERT INTO "UsageEvent" VALUES
 ('done', 'org-1', 3, 'settled', '2026-10-01'),
 ('retry', 'org-2', 4, 'settled', '2026-10-02'),
 ('new', 'org-1', 5, 'settled', '2026-10-03'),
 ('pending', 'org-1', 5, 'pending', '2026-09-01'),
 ('free', 'org-1', 0, 'settled', '2026-09-01');
INSERT INTO "AIUsageBillingSettlement" VALUES
 ('done', 'submitted', 'org-1', 3, '2026-10-15T11:00:00.000Z'),
 ('retry', 'reserved', 'org-2', 4, '2026-10-15T11:00:00.000Z');
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
 db.execute('INSERT INTO "AIUsageBillingSettlement" VALUES (?, ?, ?, ?, ?)', (name, status, org, amount, created))
print(json.dumps([row[0] for row in db.execute(query['sql'], query['values'])]))
`;
  return JSON.parse(execFileSync("python3", ["-c", script, JSON.stringify({ sql: query.sql, values: query.values })], { encoding: "utf8", timeout: 5000 }));
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
});
