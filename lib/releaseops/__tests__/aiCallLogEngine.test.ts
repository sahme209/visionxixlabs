import { describe, expect, it } from "vitest";
import {
  computeCircuitState,
  computeEngineStats,
  isAiCallOutcome,
  isCircuitState,
  shouldShortCircuit,
  type CallSummary,
  type OutcomeRow,
} from "../aiCallLogEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

function minutesAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 60_000);
}

function row(outcome: string, ageMin: number): OutcomeRow {
  return { outcome, startedAt: minutesAgo(ageMin) };
}

describe("isAiCallOutcome", () => {
  it("accepts every closed-union outcome", () => {
    expect(isAiCallOutcome("ok")).toBe(true);
    expect(isAiCallOutcome("error")).toBe(true);
    expect(isAiCallOutcome("timeout")).toBe(true);
    expect(isAiCallOutcome("short_circuit")).toBe(true);
  });
  it("rejects unknown outcomes", () => {
    expect(isAiCallOutcome("blocked")).toBe(false);
    expect(isAiCallOutcome("")).toBe(false);
  });
});

describe("isCircuitState", () => {
  it("accepts every closed-union state", () => {
    expect(isCircuitState("closed")).toBe(true);
    expect(isCircuitState("open")).toBe(true);
    expect(isCircuitState("half_open")).toBe(true);
  });
  it("rejects unknown states", () => {
    expect(isCircuitState("tripped")).toBe(false);
  });
});

describe("computeCircuitState", () => {
  it("returns 'closed' when there are no outcomes", () => {
    expect(computeCircuitState([], NOW)).toBe("closed");
  });

  it("returns 'closed' when failures are below threshold", () => {
    const outcomes: OutcomeRow[] = [
      row("error", 1),
      row("ok", 2),
      row("ok", 3),
      row("ok", 4),
    ];
    expect(computeCircuitState(outcomes, NOW, { errorThreshold: 3 })).toBe("closed");
  });

  it("returns 'open' when failures meet threshold and most-recent failure is within cooldown", () => {
    const outcomes: OutcomeRow[] = [
      row("error", 0.5),
      row("error", 1),
      row("error", 2),
      row("ok", 3),
    ];
    const state = computeCircuitState(outcomes, NOW, { errorThreshold: 3, cooldownMs: 60_000 });
    expect(state).toBe("open");
  });

  it("returns 'half_open' once cooldown elapses since the most recent failure", () => {
    const outcomes: OutcomeRow[] = [
      row("error", 5),
      row("error", 6),
      row("error", 7),
      row("ok", 8),
    ];
    // 5 min since most recent error >> 60s cooldown → half_open
    const state = computeCircuitState(outcomes, NOW, { errorThreshold: 3, cooldownMs: 60_000 });
    expect(state).toBe("half_open");
  });

  it("ignores short_circuit rows (those are not provider observations)", () => {
    const outcomes: OutcomeRow[] = [
      row("short_circuit", 0.5),
      row("short_circuit", 1),
      row("short_circuit", 2),
      row("ok", 3),
    ];
    // Three short_circuits would otherwise look like failures, but
    // the breaker ignores them.
    expect(computeCircuitState(outcomes, NOW, { errorThreshold: 3 })).toBe("closed");
  });

  it("treats 'timeout' as a failure equivalent to 'error'", () => {
    const outcomes: OutcomeRow[] = [
      row("timeout", 0.5),   // 30s ago — well within 60s cooldown
      row("error", 2),
      row("timeout", 3),
      row("ok", 4),
    ];
    expect(computeCircuitState(outcomes, NOW, { errorThreshold: 3, cooldownMs: 60_000 })).toBe("open");
  });

  it("respects windowSize — failures outside the window don't count", () => {
    // 5 errors total but only the most recent 2 are within window=2.
    const outcomes: OutcomeRow[] = [
      row("ok", 0.5),
      row("ok", 1),
      row("error", 2),
      row("error", 3),
      row("error", 4),
    ];
    const state = computeCircuitState(outcomes, NOW, { windowSize: 2, errorThreshold: 3 });
    expect(state).toBe("closed");
  });

  it("recovers to half_open at the exact cooldown boundary", () => {
    const outcomes: OutcomeRow[] = [
      row("error", 1),       // 60 seconds ago = exactly cooldown
      row("error", 2),
      row("error", 3),
    ];
    expect(computeCircuitState(outcomes, NOW, { errorThreshold: 3, cooldownMs: 60_000 })).toBe("half_open");
  });

  it("a single recent error after cooldown re-opens the breaker", () => {
    const outcomes: OutcomeRow[] = [
      row("error", 0.5),     // fresh
      row("error", 5),
      row("error", 6),
      row("error", 7),
    ];
    // Even though older errors are past cooldown, the newest is fresh.
    expect(computeCircuitState(outcomes, NOW, { errorThreshold: 3, cooldownMs: 60_000 })).toBe("open");
  });
});

describe("shouldShortCircuit", () => {
  it("only short-circuits when state is 'open'", () => {
    expect(shouldShortCircuit("open")).toBe(true);
    expect(shouldShortCircuit("half_open")).toBe(false);
    expect(shouldShortCircuit("closed")).toBe(false);
  });
});

describe("computeEngineStats", () => {
  function call(outcome: string, latencyMs: number, prompt?: number, completion?: number): CallSummary {
    return {
      outcome,
      latencyMs,
      totalTokens: typeof prompt === "number" && typeof completion === "number" ? prompt + completion : null,
      promptTokens: prompt ?? null,
      completionTokens: completion ?? null,
    };
  }

  it("returns zeroed stats for empty input", () => {
    const s = computeEngineStats([]);
    expect(s.windowSize).toBe(0);
    expect(s.okCount).toBe(0);
    expect(s.latencyP50Ms).toBe(0);
    expect(s.successRate).toBe(0);
  });

  it("counts outcomes by closed-union", () => {
    const s = computeEngineStats([
      call("ok", 100),
      call("ok", 200),
      call("error", 5000),
      call("timeout", 30000),
      call("short_circuit", 0),
    ]);
    expect(s.okCount).toBe(2);
    expect(s.errorCount).toBe(1);
    expect(s.timeoutCount).toBe(1);
    expect(s.shortCircuitCount).toBe(1);
  });

  it("excludes short_circuit calls from p50/p95 latency", () => {
    // Adding 1000 zero-latency short_circuit calls should not move p50/p95.
    const baseline: CallSummary[] = [
      call("ok", 100),
      call("ok", 200),
      call("ok", 300),
    ];
    const noisy = [...baseline];
    for (let i = 0; i < 1000; i++) noisy.push(call("short_circuit", 0));
    const baselineStats = computeEngineStats(baseline);
    const noisyStats = computeEngineStats(noisy);
    expect(noisyStats.latencyP50Ms).toBe(baselineStats.latencyP50Ms);
    expect(noisyStats.latencyP95Ms).toBe(baselineStats.latencyP95Ms);
  });

  it("computes nearest-rank p50/p95 correctly", () => {
    // 10 calls with latencies 100..1000
    const calls: CallSummary[] = [];
    for (let i = 1; i <= 10; i++) calls.push(call("ok", i * 100));
    const s = computeEngineStats(calls);
    expect(s.latencyP50Ms).toBe(600); // index 5 (0.5 * 10)
    expect(s.latencyP95Ms).toBe(1000); // index 9 (0.95 * 10 = 9)
  });

  it("sums token usage across the window", () => {
    const s = computeEngineStats([
      call("ok", 100, 50, 20),
      call("ok", 200, 100, 30),
      call("error", 5000, 200, 0),
    ]);
    expect(s.promptTokensTotal).toBe(350);
    expect(s.completionTokensTotal).toBe(50);
  });

  it("ignores null token counts in totals", () => {
    const s = computeEngineStats([
      call("ok", 100, 50, 20),
      call("ok", 200),          // null tokens
      call("error", 5000),      // null tokens
    ]);
    expect(s.promptTokensTotal).toBe(50);
    expect(s.completionTokensTotal).toBe(20);
  });

  it("success rate excludes short_circuit from denominator", () => {
    const s = computeEngineStats([
      call("ok", 100),
      call("ok", 200),
      call("error", 300),
      call("short_circuit", 0),
      call("short_circuit", 0),
    ]);
    // 2 ok / (2 ok + 1 error) = 2/3
    expect(s.successRate).toBeCloseTo(2 / 3);
  });

  it("success rate is 0 when no provider calls fired", () => {
    const s = computeEngineStats([
      call("short_circuit", 0),
      call("short_circuit", 0),
    ]);
    expect(s.successRate).toBe(0);
  });
});
