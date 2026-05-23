import { describe, it, expect } from "vitest";
import { extractStageTelemetry } from "../extractStageTelemetry";
import { rollupStageTelemetry, type StageTelemetryRow } from "../rollupStageTelemetry";
import { assertRunCostBudget, DEFAULT_RUN_MAX_CENTS } from "../assertRunCostBudget";

// ============================ extractStageTelemetry ============================

describe("extractStageTelemetry — shape 1 (codeProposeRealExecutor)", () => {
  it("extracts cost.totalCents + usage.{input,output}_tokens", () => {
    const r = extractStageTelemetry({
      cost: { totalCents: 47 },
      usage: { input_tokens: 1000, output_tokens: 200 },
    });
    expect(r.costCents).toBe(47);
    expect(r.tokensInput).toBe(1000);
    expect(r.tokensOutput).toBe(200);
  });

  it("applies latencyMsOverride", () => {
    const r = extractStageTelemetry(
      { cost: { totalCents: 10 }, usage: { input_tokens: 5, output_tokens: 2 } },
      3500,
    );
    expect(r.latencyMs).toBe(3500);
  });

  it("handles cost.totalCents === null gracefully", () => {
    const r = extractStageTelemetry({ cost: { totalCents: null }, usage: {} });
    expect(r.costCents).toBe(0);
    expect(r.tokensInput).toBe(0);
  });
});

describe("extractStageTelemetry — shape 2 (explicit telemetry block)", () => {
  it("prefers the telemetry block when present", () => {
    const r = extractStageTelemetry({
      telemetry: { costCents: 12, tokensInput: 50, tokensOutput: 10, latencyMs: 800 },
      // Decoy shape-1 fields — should be ignored.
      cost: { totalCents: 999 },
    });
    expect(r.costCents).toBe(12);
    expect(r.tokensInput).toBe(50);
    expect(r.latencyMs).toBe(800);
  });
});

describe("extractStageTelemetry — shape 3 (legacy top-level)", () => {
  it("falls back to top-level fields when no shape-1/2 keys present", () => {
    const r = extractStageTelemetry({ costCents: 7, tokensInput: 100, tokensOutput: 20 });
    expect(r.costCents).toBe(7);
    expect(r.tokensInput).toBe(100);
    expect(r.tokensOutput).toBe(20);
  });
});

describe("extractStageTelemetry — defensive", () => {
  it("null detail returns zeros (+ optional latency)", () => {
    const r = extractStageTelemetry(null, 100);
    expect(r.costCents).toBe(0);
    expect(r.latencyMs).toBe(100);
  });

  it("non-object detail returns zeros", () => {
    expect(extractStageTelemetry("garbage").costCents).toBe(0);
    expect(extractStageTelemetry(42).tokensInput).toBe(0);
  });

  it("negative numbers clamp to 0", () => {
    const r = extractStageTelemetry({
      telemetry: { costCents: -5, tokensInput: -1, tokensOutput: 10, latencyMs: -1 },
    });
    expect(r.costCents).toBe(0);
    expect(r.tokensInput).toBe(0);
    expect(r.tokensOutput).toBe(10);
    expect(r.latencyMs).toBe(0);
  });

  it("NaN / Infinity floors to 0", () => {
    const r = extractStageTelemetry({
      telemetry: { costCents: NaN, tokensInput: Infinity, tokensOutput: -Infinity, latencyMs: 0 },
    });
    expect(r.costCents).toBe(0);
    expect(r.tokensInput).toBe(0);
    expect(r.tokensOutput).toBe(0);
  });

  it("floors fractional cents (telemetry should be integer)", () => {
    const r = extractStageTelemetry({ telemetry: { costCents: 4.7, tokensInput: 0, tokensOutput: 0, latencyMs: 0 } });
    expect(r.costCents).toBe(4);
  });
});

// ============================ rollupStageTelemetry ============================

function row(overrides: Partial<StageTelemetryRow>): StageTelemetryRow {
  return {
    stageId: overrides.stageId ?? "stage",
    stageKind: overrides.stageKind ?? "code_propose",
    status: overrides.status ?? "succeeded",
    ordering: overrides.ordering ?? 0,
    costCents: overrides.costCents ?? 0,
    tokensInput: overrides.tokensInput ?? 0,
    tokensOutput: overrides.tokensOutput ?? 0,
    latencyMs: overrides.latencyMs ?? 0,
  };
}

describe("rollupStageTelemetry — totals", () => {
  it("sums every numeric field", () => {
    const r = rollupStageTelemetry([
      row({ costCents: 10, tokensInput: 100, tokensOutput: 20, latencyMs: 500 }),
      row({ costCents: 5,  tokensInput: 50,  tokensOutput: 10, latencyMs: 200 }),
    ]);
    expect(r.totalCostCents).toBe(15);
    expect(r.totalTokensInput).toBe(150);
    expect(r.totalTokensOutput).toBe(30);
    expect(r.totalLatencyMs).toBe(700);
  });

  it("counts succeeded vs failed stages", () => {
    const r = rollupStageTelemetry([
      row({ status: "succeeded" }), row({ status: "succeeded" }),
      row({ status: "failed" }),    row({ status: "queued" }),
    ]);
    expect(r.succeededCount).toBe(2);
    expect(r.failedCount).toBe(1);
    expect(r.stageCount).toBe(4);
  });

  it("hasCost flag flips on any non-zero cost", () => {
    expect(rollupStageTelemetry([row({})]).hasCost).toBe(false);
    expect(rollupStageTelemetry([row({ costCents: 1 })]).hasCost).toBe(true);
  });
});

describe("rollupStageTelemetry — top spenders", () => {
  it("returns top-N stages ordered by costCents desc", () => {
    const r = rollupStageTelemetry([
      row({ stageId: "a", costCents: 5 }),
      row({ stageId: "b", costCents: 30 }),
      row({ stageId: "c", costCents: 10 }),
      row({ stageId: "d", costCents: 0 }),  // zero-cost rows excluded
    ]);
    expect(r.topByCostCents.map((s) => s.stageId)).toEqual(["b", "c", "a"]);
  });

  it("respects custom topN", () => {
    const r = rollupStageTelemetry(
      [row({ costCents: 1 }), row({ costCents: 2 }), row({ costCents: 3 })],
      { topN: 2 },
    );
    expect(r.topByCostCents.length).toBe(2);
  });
});

// ============================ assertRunCostBudget ============================

describe("assertRunCostBudget — under cap", () => {
  it("allowed when far below", () => {
    const r = assertRunCostBudget({ spentCents: 50, maxCents: 500 });
    expect(r.kind).toBe("allowed");
    expect(r.allowed).toBe(true);
    expect(r.remainingCents).toBe(450);
  });

  it("flips to warn at 80% threshold", () => {
    const r = assertRunCostBudget({ spentCents: 400, maxCents: 500 });
    expect(r.kind).toBe("allowed_warn_threshold");
    expect(r.allowed).toBe(true);
    expect(r.warnThresholdCrossed).toBe(true);
  });

  it("warn threshold is configurable", () => {
    const r = assertRunCostBudget({ spentCents: 60, maxCents: 100, warnAtRatio: 0.5 });
    expect(r.kind).toBe("allowed_warn_threshold");
  });
});

describe("assertRunCostBudget — at or over cap", () => {
  it("halts exactly at the cap", () => {
    const r = assertRunCostBudget({ spentCents: 500, maxCents: 500 });
    expect(r.kind).toBe("halt_budget_exceeded");
    expect(r.allowed).toBe(false);
    expect(r.remainingCents).toBe(0);
  });

  it("halts over the cap", () => {
    const r = assertRunCostBudget({ spentCents: 750, maxCents: 500 });
    expect(r.kind).toBe("halt_budget_exceeded");
    expect(r.ratio).toBeCloseTo(1.5);
  });

  it("zero/negative cap halts", () => {
    expect(assertRunCostBudget({ spentCents: 0, maxCents: 0 }).allowed).toBe(false);
    expect(assertRunCostBudget({ spentCents: 0, maxCents: -1 }).allowed).toBe(false);
  });
});

describe("assertRunCostBudget — unlimited", () => {
  it("null cap → always allowed, no warn flag", () => {
    const r = assertRunCostBudget({ spentCents: 1_000_000, maxCents: null });
    expect(r.allowed).toBe(true);
    expect(r.warnThresholdCrossed).toBe(false);
    expect(r.maxCents).toBe(Number.POSITIVE_INFINITY);
    expect(r.remainingCents).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("DEFAULT_RUN_MAX_CENTS", () => {
  it("is set to a sensible default ($5)", () => {
    expect(DEFAULT_RUN_MAX_CENTS).toBe(500);
  });
});
