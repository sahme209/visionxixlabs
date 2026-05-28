import { describe, expect, it } from "vitest";
import {
  buildMemorySummaryTimelineResponse,
  persistMemorySummary,
  type MemorySummaryRepo,
  type SummaryLogRow,
} from "../aiMemorySummaryResponder";
import type { MemorySummary } from "../aiMemorySummaryEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

interface Stub extends MemorySummaryRepo {
  _rows: SummaryLogRow[];
  _failNext?: "missing_table" | "boom";
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    aiMemorySummaryLog: {
      async create({ data }) {
        if (stub._failNext === "missing_table") {
          stub._failNext = undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = new Error("relation does not exist");
          e.code = "P2021";
          throw e;
        }
        if (stub._failNext === "boom") {
          stub._failNext = undefined;
          throw new Error("db down");
        }
        const row: SummaryLogRow = {
          id: `sum_${stub._rows.length + 1}`,
          organizationId: data.organizationId,
          targetKind: data.targetKind,
          narrative: data.narrative,
          themesJson: data.themesJson,
          notableEntriesJson: data.notableEntriesJson,
          outcome: data.outcome,
          errorMessage: data.errorMessage,
          modelHint: data.modelHint,
          windowSize: data.windowSize,
          aiAvailabilityPct: data.aiAvailabilityPct,
          engineVersion: data.engineVersion,
          generatedAt: new Date(NOW.getTime() + stub._rows.length * 1000),
        };
        stub._rows.push(row);
        return row;
      },
      async findMany({ where, take }) {
        if (stub._failNext === "missing_table") {
          stub._failNext = undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = new Error("relation does not exist");
          e.code = "P2021";
          throw e;
        }
        if (stub._failNext === "boom") {
          stub._failNext = undefined;
          throw new Error("db down");
        }
        const filtered = stub._rows.filter((r) => {
          if (r.organizationId !== where.organizationId) return false;
          if (where.targetKind !== undefined && r.targetKind !== where.targetKind) return false;
          return true;
        }).sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
        return typeof take === "number" ? filtered.slice(0, take) : filtered;
      },
    },
  };
  return stub;
}

function summary(overrides: Partial<MemorySummary> = {}): MemorySummary {
  return {
    outcome: "ai_generated",
    narrative: "AGI summarized last 50 entries.",
    themes: ["theme1", "theme2"],
    notableEntries: ["review X", "fix Y"],
    aiAvailabilityPct: 80,
    windowSize: 10,
    modelHint: "claude-opus-4-7",
    errorMessage: null,
    engineVersion: "v1",
    ...overrides,
  };
}

describe("persistMemorySummary", () => {
  it("returns view on success + writes row", async () => {
    const stub = makeRepo();
    const out = await persistMemorySummary(stub, "o", null, summary());
    expect(out).not.toBeNull();
    expect(out!.narrative).toContain("AGI summarized");
    expect(out!.themes).toEqual(["theme1", "theme2"]);
    expect(out!.windowSize).toBe(10);
    expect(stub._rows.length).toBe(1);
  });

  it("returns null on db failure (never throws)", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    const out = await persistMemorySummary(stub, "o", null, summary());
    expect(out).toBeNull();
    expect(stub._rows.length).toBe(0);
  });

  it("returns null on missing_table without throwing", async () => {
    const stub = makeRepo();
    stub._failNext = "missing_table";
    const out = await persistMemorySummary(stub, "o", null, summary());
    expect(out).toBeNull();
  });

  it("persists targetKind when supplied", async () => {
    const stub = makeRepo();
    await persistMemorySummary(stub, "o", "council", summary());
    expect(stub._rows[0].targetKind).toBe("council");
  });

  it("persists null targetKind when summary covers all surfaces", async () => {
    const stub = makeRepo();
    await persistMemorySummary(stub, "o", null, summary());
    expect(stub._rows[0].targetKind).toBeNull();
  });
});

describe("buildMemorySummaryTimelineResponse", () => {
  async function seed(stub: Stub) {
    await persistMemorySummary(stub, "o", null, summary({ outcome: "ai_generated" }));
    await persistMemorySummary(stub, "o", "council", summary({ outcome: "fallback_rules", modelHint: null }));
    await persistMemorySummary(stub, "o", "triage", summary({ outcome: "ai_generated" }));
    await persistMemorySummary(stub, "o", null, summary({ outcome: "error" }));
    await persistMemorySummary(stub, "other-org", null, summary({ outcome: "ai_generated" }));
  }

  it("200 returns entries sorted newest-first, scoped to org", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildMemorySummaryTimelineResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.entries).toHaveLength(4);
    expect(r.body.data.entries[0].outcome).toBe("error"); // newest
  });

  it("tallies per-outcome summary", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildMemorySummaryTimelineResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary).toEqual({ total: 4, aiGenerated: 2, fallbackRules: 1, errored: 1 });
  });

  it("filters by targetKind=null (all-surface summaries only)", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildMemorySummaryTimelineResponse(stub, { organizationId: "o", targetKind: null });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.entries).toHaveLength(2);
    expect(r.body.data.entries.every((e) => e.targetKind === null)).toBe(true);
  });

  it("filters by specific targetKind", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildMemorySummaryTimelineResponse(stub, { organizationId: "o", targetKind: "council" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.entries).toHaveLength(1);
    expect(r.body.data.entries[0].targetKind).toBe("council");
  });

  it("clamps take to [1, 200]", async () => {
    const stub = makeRepo();
    await seed(stub);

    const r1 = await buildMemorySummaryTimelineResponse(stub, { organizationId: "o", take: 1 });
    if (!r1.body.ok) throw new Error("expected ok");
    expect(r1.body.data.entries).toHaveLength(1);

    const r2 = await buildMemorySummaryTimelineResponse(stub, { organizationId: "o", take: 9999 });
    if (!r2.body.ok) throw new Error("expected ok");
    expect(r2.body.data.entries).toHaveLength(4);

    const r3 = await buildMemorySummaryTimelineResponse(stub, { organizationId: "o", take: 0 });
    if (!r3.body.ok) throw new Error("expected ok");
    expect(r3.body.data.entries.length).toBeGreaterThanOrEqual(1);
  });

  it("503 migration_pending when table missing", async () => {
    const stub = makeRepo();
    stub._failNext = "missing_table";
    const r = await buildMemorySummaryTimelineResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("500 read_failed on generic db error", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    const r = await buildMemorySummaryTimelineResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(500);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("read_failed");
  });

  it("200 empty when org has no summaries", async () => {
    const stub = makeRepo();
    const r = await buildMemorySummaryTimelineResponse(stub, { organizationId: "empty" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.entries).toHaveLength(0);
  });
});
