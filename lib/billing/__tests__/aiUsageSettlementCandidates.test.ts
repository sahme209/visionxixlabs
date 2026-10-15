import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { aiUsageSettlementCandidates } from "../aiUsageSettlementCandidates";

// Execute the generated ANSI SELECT against an isolated in-memory database.
// No external database or credentials are used. PostgreSQL compatibility is
// additionally checked with a disposable PostgreSQL fixture before merging.
function select(limit: number): string[] {
  const query = aiUsageSettlementCandidates(limit);
  const script = `
import json, sqlite3, sys
query = json.loads(sys.argv[1])
db = sqlite3.connect(':memory:')
db.executescript('''
CREATE TABLE "UsageEvent" (id TEXT, organizationId TEXT, billedCents INTEGER, billingStatus TEXT, createdAt TEXT);
CREATE TABLE "AIUsageBillingSettlement" (usageEventId TEXT, status TEXT);
INSERT INTO "UsageEvent" VALUES
 ('done', 'org-1', 3, 'settled', '2026-10-01'),
 ('retry', 'org-2', 4, 'settled', '2026-10-02'),
 ('new', 'org-1', 5, 'settled', '2026-10-03'),
 ('pending', 'org-1', 5, 'pending', '2026-09-01'),
 ('free', 'org-1', 0, 'settled', '2026-09-01');
INSERT INTO "AIUsageBillingSettlement" VALUES ('done', 'submitted'), ('retry', 'reserved');
''')
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
    expect(aiUsageSettlementCandidates(input).values).toEqual([expected]);
  });
});
