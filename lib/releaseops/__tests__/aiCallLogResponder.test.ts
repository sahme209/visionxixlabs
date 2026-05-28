import { describe, expect, it } from "vitest";
import {
  buildAiCallLogResponse,
  lookupCircuitState,
  persistAiCallLog,
  type AiCallLogRepo,
  type CallLogRow,
} from "../aiCallLogResponder";

const NOW = new Date("2026-05-28T12:00:00Z");

interface Stub extends AiCallLogRepo {
  _rows: CallLogRow[];
  _failNext?: "missing_table" | "boom";
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    aiCallLog: {
      async create({ data }) {
        if (stub._failNext === "missing_table") {
          stub._failNext = undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = new Error("relation does not exist");
          e.code = "P2021";
          throw e;
        }
        if (stub._failNext === "boom") { stub._failNext = undefined; throw new Error("db down"); }
        const row: CallLogRow = {
          id: `call_${stub._rows.length + 1}`,
          organizationId: data.organizationId,
          engineName: data.engineName,
          model: data.model,
          outcome: data.outcome,
          errorMessage: data.errorMessage,
          latencyMs: data.latencyMs,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          startedAt: new Date(NOW.getTime() + stub._rows.length * 100),
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
        if (stub._failNext === "boom") { stub._failNext = undefined; throw new Error("db down"); }
        const filtered = stub._rows.filter((r) => {
          if (where.engineName && r.engineName !== where.engineName) return false;
          if (where.organizationId !== undefined && r.organizationId !== where.organizationId) return false;
          return true;
        }).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
        return typeof take === "number" ? filtered.slice(0, take) : filtered;
      },
    },
  };
  return stub;
}

function input(overrides: Partial<Parameters<typeof persistAiCallLog>[1]> = {}) {
  return {
    organizationId: "o",
    engineName: "council_voter",
    model: "claude-opus-4-7",
    outcome: "ok",
    errorMessage: null,
    latencyMs: 850,
    promptTokens: 1200,
    completionTokens: 80,
    totalTokens: 1280,
    ...overrides,
  };
}

describe("persistAiCallLog", () => {
  it("returns view on success and writes row", async () => {
    const stub = makeRepo();
    const view = await persistAiCallLog(stub, input());
    expect(view).not.toBeNull();
    expect(view!.engineName).toBe("council_voter");
    expect(view!.latencyMs).toBe(850);
    expect(stub._rows.length).toBe(1);
  });

  it("returns null on missing_table without throwing", async () => {
    const stub = makeRepo();
    stub._failNext = "missing_table";
    expect(await persistAiCallLog(stub, input())).toBeNull();
  });

  it("returns null on db failure (never throws)", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    expect(await persistAiCallLog(stub, input())).toBeNull();
  });

  it("persists null organizationId for unscoped calls", async () => {
    const stub = makeRepo();
    await persistAiCallLog(stub, input({ organizationId: null }));
    expect(stub._rows[0].organizationId).toBeNull();
  });
});

describe("lookupCircuitState", () => {
  it("returns 'closed' when no rows exist", async () => {
    const stub = makeRepo();
    expect(await lookupCircuitState(stub, "council_voter", NOW)).toBe("closed");
  });

  it("returns 'open' when 3+ recent errors flooded the window", async () => {
    const stub = makeRepo();
    for (let i = 0; i < 3; i++) await persistAiCallLog(stub, input({ outcome: "error" }));
    // All rows are now within microseconds, so cooldown hasn't elapsed.
    expect(await lookupCircuitState(stub, "council_voter", NOW)).toBe("open");
  });

  it("returns 'closed' if reading the log throws (fail-open)", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    expect(await lookupCircuitState(stub, "council_voter", NOW)).toBe("closed");
  });

  it("scopes the window to the engine name", async () => {
    const stub = makeRepo();
    for (let i = 0; i < 3; i++) await persistAiCallLog(stub, input({ outcome: "error", engineName: "council_voter" }));
    // A different engine should be unaffected.
    expect(await lookupCircuitState(stub, "memory_chat", NOW)).toBe("closed");
  });
});

describe("buildAiCallLogResponse", () => {
  async function seed(stub: Stub) {
    await persistAiCallLog(stub, input({ engineName: "council_voter", outcome: "ok", latencyMs: 1200, promptTokens: 800, completionTokens: 60, totalTokens: 860 }));
    await persistAiCallLog(stub, input({ engineName: "council_voter", outcome: "ok", latencyMs: 1400, promptTokens: 900, completionTokens: 70, totalTokens: 970 }));
    await persistAiCallLog(stub, input({ engineName: "memory_chat", outcome: "error", latencyMs: 5500, errorMessage: "timeout", promptTokens: 200, completionTokens: 0, totalTokens: 200 }));
    await persistAiCallLog(stub, input({ engineName: "memory_chat", outcome: "short_circuit", latencyMs: 0, model: null, promptTokens: null, completionTokens: null, totalTokens: null }));
    await persistAiCallLog(stub, input({ engineName: "proactive_suggestion", outcome: "timeout", latencyMs: 30000, errorMessage: "request timed out", promptTokens: 100, completionTokens: 0, totalTokens: 100 }));
  }

  it("returns calls newest-first with summary tally", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildAiCallLogResponse(stub);
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.calls.length).toBe(5);
    expect(r.body.data.summary).toEqual({
      total: 5,
      ok: 2,
      error: 1,
      timeout: 1,
      shortCircuit: 1,
      totalLatencyMs: 1200 + 1400 + 5500 + 30000, // short_circuit excluded
      totalPromptTokens: 800 + 900 + 200 + 100,
      totalCompletionTokens: 60 + 70 + 0 + 0,
    });
  });

  it("groups breakdown by engineName + applies circuit state", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildAiCallLogResponse(stub);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.engines.length).toBe(3);
    // Sorted by windowSize desc; council_voter + memory_chat both have
    // 2 calls each (tie). proactive_suggestion has 1 — should be last.
    const top2 = r.body.data.engines.slice(0, 2).map((e) => e.engineName).sort();
    expect(top2).toEqual(["council_voter", "memory_chat"]);
    expect(r.body.data.engines[2].engineName).toBe("proactive_suggestion");
    // States are derived from each engine's own window.
    for (const e of r.body.data.engines) {
      expect(["closed", "open", "half_open"]).toContain(e.state);
    }
  });

  it("filters calls by engineName when supplied", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildAiCallLogResponse(stub, { engineName: "council_voter" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.calls.length).toBe(2);
    expect(r.body.data.calls.every((c) => c.engineName === "council_voter")).toBe(true);
  });

  it("scopes by organizationId when supplied", async () => {
    const stub = makeRepo();
    await persistAiCallLog(stub, input({ organizationId: "o1" }));
    await persistAiCallLog(stub, input({ organizationId: "o2" }));
    const r = await buildAiCallLogResponse(stub, { organizationId: "o1" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.calls.length).toBe(1);
    expect(r.body.data.calls[0].organizationId).toBe("o1");
  });

  it("clamps take to [1, 500]", async () => {
    const stub = makeRepo();
    for (let i = 0; i < 7; i++) await persistAiCallLog(stub, input());

    const r1 = await buildAiCallLogResponse(stub, { take: 3 });
    if (!r1.body.ok) throw new Error("expected ok");
    expect(r1.body.data.calls.length).toBe(3);

    const r2 = await buildAiCallLogResponse(stub, { take: 9999 });
    if (!r2.body.ok) throw new Error("expected ok");
    expect(r2.body.data.calls.length).toBe(7);

    const r3 = await buildAiCallLogResponse(stub, { take: 0 });
    if (!r3.body.ok) throw new Error("expected ok");
    expect(r3.body.data.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("503 migration_pending when table missing", async () => {
    const stub = makeRepo();
    stub._failNext = "missing_table";
    const r = await buildAiCallLogResponse(stub);
    expect(r.status).toBe(503);
  });

  it("500 read_failed on generic db error", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    const r = await buildAiCallLogResponse(stub);
    expect(r.status).toBe(500);
  });

  it("200 empty when no calls logged yet", async () => {
    const stub = makeRepo();
    const r = await buildAiCallLogResponse(stub);
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.calls.length).toBe(0);
    expect(r.body.data.engines.length).toBe(0);
  });

  it("ignores short_circuit rows in p50/p95 latency for each engine breakdown", async () => {
    const stub = makeRepo();
    // 3 fast ok calls + 10 zero-latency short_circuits → p50/p95 should
    // come from the ok calls, not the short_circuits.
    await persistAiCallLog(stub, input({ engineName: "e1", outcome: "ok", latencyMs: 100 }));
    await persistAiCallLog(stub, input({ engineName: "e1", outcome: "ok", latencyMs: 200 }));
    await persistAiCallLog(stub, input({ engineName: "e1", outcome: "ok", latencyMs: 300 }));
    for (let i = 0; i < 10; i++) await persistAiCallLog(stub, input({ engineName: "e1", outcome: "short_circuit", latencyMs: 0 }));
    const r = await buildAiCallLogResponse(stub, { take: 500 });
    if (!r.body.ok) throw new Error("expected ok");
    const e1 = r.body.data.engines.find((e) => e.engineName === "e1")!;
    expect(e1.stats.latencyP50Ms).toBeGreaterThan(0);
    expect(e1.stats.latencyP95Ms).toBeGreaterThan(0);
  });
});
