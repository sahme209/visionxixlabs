import { describe, expect, it } from "vitest";
import { buildUsageSummaryResponse, type UsageSummaryRepo } from "../usageSummaryResponder";

function makeRepo(aggregateResult: { inputTokens: number | null; outputTokens: number | null; costCents: number | null; count: number }): UsageSummaryRepo {
  return {
    usageEvent: {
      async aggregate() {
        return {
          _sum: { inputTokens: aggregateResult.inputTokens, outputTokens: aggregateResult.outputTokens, costCents: aggregateResult.costCents },
          _count: { _all: aggregateResult.count },
        };
      },
    },
  };
}

describe("buildUsageSummaryResponse", () => {
  it("returns zeros when there's no usage yet this month", async () => {
    const repo = makeRepo({ inputTokens: null, outputTokens: null, costCents: null, count: 0 });
    const r = await buildUsageSummaryResponse(repo, "org-1", { now: new Date("2026-03-15T00:00:00Z") });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data).toEqual({ periodMonth: "2026-03", aiInvocationCount: 0, aiInputTokens: 0, aiOutputTokens: 0, aiCostCents: 0 });
  });

  it("sums real usage for the current month", async () => {
    const repo = makeRepo({ inputTokens: 15000, outputTokens: 4200, costCents: 350, count: 12 });
    const r = await buildUsageSummaryResponse(repo, "org-1", { now: new Date("2026-03-15T00:00:00Z") });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.aiInvocationCount).toBe(12);
    expect(r.body.data.aiInputTokens).toBe(15000);
    expect(r.body.data.aiOutputTokens).toBe(4200);
    expect(r.body.data.aiCostCents).toBe(350);
  });

  it("formats periodMonth with a zero-padded month", async () => {
    const repo = makeRepo({ inputTokens: 0, outputTokens: 0, costCents: 0, count: 0 });
    const r = await buildUsageSummaryResponse(repo, "org-1", { now: new Date("2026-01-05T00:00:00Z") });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.periodMonth).toBe("2026-01");
  });

  it("503 migration_pending when the table doesn't exist yet", async () => {
    const repo: UsageSummaryRepo = {
      usageEvent: {
        async aggregate() {
          throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
        },
      },
    };
    const r = await buildUsageSummaryResponse(repo, "org-1");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
