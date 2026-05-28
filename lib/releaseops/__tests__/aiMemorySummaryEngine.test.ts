import { describe, expect, it } from "vitest";
import {
  buildMemoryFallbackSummary,
  buildMemorySummaryPrompt,
  computeWindowStats,
  MEMORY_SUMMARY_ENGINE_VERSION,
  summarizeAgiMemory,
  type MemoryEntryForSummary,
} from "../aiMemorySummaryEngine";
import type { RationaleAiFetcher } from "../aiRationaleEnricherEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

function entry(overrides: Partial<MemoryEntryForSummary> = {}): MemoryEntryForSummary {
  return {
    targetKind: "council",
    targetId: "c1",
    narrative: "Council blocked due to blocking violations.",
    outcome: "ai_generated",
    modelHint: "claude-opus-4-7",
    generatedAtIso: NOW.toISOString(),
    ...overrides,
  };
}

describe("computeWindowStats", () => {
  it("tallies per-surface counts and outcomes", () => {
    const stats = computeWindowStats([
      entry({ targetKind: "council", outcome: "ai_generated" }),
      entry({ targetKind: "council", outcome: "fallback_rules", modelHint: null }),
      entry({ targetKind: "triage", outcome: "ai_generated", modelHint: "claude-sonnet-4-6" }),
      entry({ targetKind: "remediation", outcome: "error" }),
    ]);
    expect(stats.total).toBe(4);
    expect(stats.aiCount).toBe(2);
    expect(stats.fallbackCount).toBe(1);
    expect(stats.errorCount).toBe(1);
    expect(stats.perTargetKind).toEqual({ council: 2, triage: 1, remediation: 1 });
    expect(stats.uniqueModels).toEqual(["claude-opus-4-7", "claude-sonnet-4-6"]);
  });

  it("tracks earliest/latest timestamps", () => {
    const stats = computeWindowStats([
      entry({ generatedAtIso: "2026-05-28T10:00:00Z" }),
      entry({ generatedAtIso: "2026-05-28T14:00:00Z" }),
      entry({ generatedAtIso: "2026-05-28T12:00:00Z" }),
    ]);
    expect(stats.earliestIso).toBe("2026-05-28T10:00:00Z");
    expect(stats.latestIso).toBe("2026-05-28T14:00:00Z");
  });

  it("handles empty window", () => {
    const stats = computeWindowStats([]);
    expect(stats.total).toBe(0);
    expect(stats.earliestIso).toBeNull();
    expect(stats.latestIso).toBeNull();
    expect(stats.uniqueModels).toEqual([]);
  });
});

describe("buildMemorySummaryPrompt", () => {
  it("includes window size, per-surface counts, outcomes, and entries", () => {
    const p = buildMemorySummaryPrompt([
      entry({ targetKind: "council", narrative: "blocked v3.4.1" }),
      entry({ targetKind: "triage", outcome: "fallback_rules", modelHint: null }),
    ]);
    expect(p).toContain("Window: 2 entries");
    expect(p).toContain('{"council":1,"triage":1}');
    expect(p).toContain("ai_generated=1, fallback_rules=1, error=0");
    expect(p).toContain("blocked v3.4.1");
    expect(p).toContain("Respond with ONLY the JSON object");
  });

  it("truncates long narratives in the prompt", () => {
    const big = "x".repeat(500);
    const p = buildMemorySummaryPrompt([entry({ narrative: big })]);
    expect(p).not.toContain(big);
  });
});

describe("buildMemoryFallbackSummary", () => {
  it("describes total, surfaces, AI availability when window has entries", () => {
    const out = buildMemoryFallbackSummary([
      entry({ targetKind: "council", outcome: "ai_generated" }),
      entry({ targetKind: "council", outcome: "ai_generated" }),
      entry({ targetKind: "triage", outcome: "fallback_rules", modelHint: null }),
      entry({ targetKind: "remediation", outcome: "fallback_rules", modelHint: null }),
    ], "no_ai");
    expect(out.outcome).toBe("fallback_rules");
    expect(out.narrative).toContain("4 rationale entries");
    expect(out.narrative).toContain("50%");
    expect(out.aiAvailabilityPct).toBe(50);
    expect(out.windowSize).toBe(4);
    expect(out.engineVersion).toBe(MEMORY_SUMMARY_ENGINE_VERSION);
  });

  it("handles empty window narrative", () => {
    const out = buildMemoryFallbackSummary([], "x");
    expect(out.narrative).toContain("No rationale entries");
    expect(out.windowSize).toBe(0);
    expect(out.aiAvailabilityPct).toBe(0);
  });

  it("flags low AI availability when fallback dominates", () => {
    const out = buildMemoryFallbackSummary([
      entry({ outcome: "fallback_rules", modelHint: null }),
      entry({ outcome: "fallback_rules", modelHint: null }),
      entry({ outcome: "fallback_rules", modelHint: null }),
      entry({ outcome: "ai_generated" }),
    ], "x");
    expect(out.themes.some((t) => t.includes("Low AI availability"))).toBe(true);
  });

  it("flags 100% AI availability", () => {
    const out = buildMemoryFallbackSummary([
      entry({ outcome: "ai_generated" }),
      entry({ outcome: "ai_generated" }),
      entry({ outcome: "ai_generated" }),
      entry({ outcome: "ai_generated" }),
    ], "x");
    expect(out.themes.some((t) => t.includes("100% AI availability"))).toBe(true);
  });

  it("flags errored entries in themes + notable", () => {
    const out = buildMemoryFallbackSummary([
      entry({ outcome: "ai_generated" }),
      entry({ outcome: "error" }),
    ], "x");
    expect(out.themes.some((t) => t.includes("errored out"))).toBe(true);
    expect(out.notableEntries.some((n) => n.includes("errored entries first"))).toBe(true);
  });

  it("recommends running an engine when window is empty", () => {
    const out = buildMemoryFallbackSummary([], "x");
    expect(out.notableEntries.some((n) => n.includes("Run any AGI engine"))).toBe(true);
  });

  it("caps themes + notableEntries at 5", () => {
    // Pad with many synthetic surface kinds.
    const many: MemoryEntryForSummary[] = [];
    for (let i = 0; i < 10; i++) many.push(entry({ targetKind: `surface_${i}`, outcome: "error" }));
    const out = buildMemoryFallbackSummary(many, "x");
    expect(out.themes.length).toBeLessThanOrEqual(5);
    expect(out.notableEntries.length).toBeLessThanOrEqual(5);
  });
});

describe("summarizeAgiMemory", () => {
  const validJson = JSON.stringify({
    narrative: "The AGI has reasoned 4 times in the last hour, blocking 2 deploys and proposing rollback once.",
    riskFactors: ["High block rate", "AI availability 100%"],
    nextActions: ["Review the 2 blocked decisions", "Confirm rollback proposal is current"],
  });

  it("returns fallback when fetcher is null", async () => {
    const out = await summarizeAgiMemory([entry()], null);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("no_ai_fetcher_configured");
  });

  it("returns fallback for empty window even when fetcher present", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validJson, modelHint: "claude-opus-4-7" });
    const out = await summarizeAgiMemory([], fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("empty_window");
  });

  it("returns ai_generated on valid response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validJson, modelHint: "claude-opus-4-7" });
    const out = await summarizeAgiMemory([entry(), entry({ outcome: "fallback_rules", modelHint: null })], fetcher);
    expect(out.outcome).toBe("ai_generated");
    expect(out.narrative).toContain("AGI has reasoned");
    expect(out.themes).toContain("High block rate");
    expect(out.notableEntries).toContain("Review the 2 blocked decisions");
    expect(out.windowSize).toBe(2);
    expect(out.aiAvailabilityPct).toBe(50);
    expect(out.modelHint).toBe("claude-opus-4-7");
  });

  it("returns error outcome + fallback content when fetcher throws", async () => {
    const fetcher: RationaleAiFetcher = async () => { throw new Error("api down"); };
    const out = await summarizeAgiMemory([entry()], fetcher);
    expect(out.outcome).toBe("error");
    expect(out.errorMessage).toContain("api down");
    expect(out.narrative.length).toBeGreaterThan(0);
  });

  it("falls back on empty response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "   ", modelHint: null });
    const out = await summarizeAgiMemory([entry()], fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("empty_ai_response");
  });

  it("falls back on unparseable response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "{ totally not json", modelHint: null });
    const out = await summarizeAgiMemory([entry()], fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("unparseable_ai_response");
  });

  it("pins MEMORY_SUMMARY_ENGINE_VERSION", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validJson, modelHint: null });
    const out = await summarizeAgiMemory([entry()], fetcher);
    expect(out.engineVersion).toBe(MEMORY_SUMMARY_ENGINE_VERSION);
  });
});
