import { describe, expect, it } from "vitest";
import {
  buildFallbackSuggestions,
  buildSuggestionPrompt,
  generateProactiveSuggestions,
  isSuggestionKind,
  parseSuggestionResponse,
  PROACTIVE_SUGGESTION_ENGINE_VERSION,
  type SuggestionContextEntry,
  type SuggestionContextSummary,
} from "../proactiveAgiSuggestionEngine";
import type { RationaleAiFetcher } from "../aiRationaleEnricherEngine";

const NOW_ISO = "2026-05-28T12:00:00Z";

function entry(id: string, overrides: Partial<SuggestionContextEntry> = {}): SuggestionContextEntry {
  return {
    citationId: id,
    targetKind: "council",
    targetId: `c_${id}`,
    rowTargetKind: "council",
    rowTargetId: `c_${id}`,
    narrative: `Council reasoning ${id}.`,
    outcome: "ai_generated",
    modelHint: "claude-opus-4-7",
    generatedAtIso: NOW_ISO,
    ...overrides,
  };
}

function sum(id: string, overrides: Partial<SuggestionContextSummary> = {}): SuggestionContextSummary {
  return {
    citationId: id,
    targetKind: null,
    narrative: `Summary ${id}.`,
    generatedAtIso: NOW_ISO,
    ...overrides,
  };
}

describe("isSuggestionKind", () => {
  it("accepts every closed-union kind", () => {
    expect(isSuggestionKind("review_release")).toBe(true);
    expect(isSuggestionKind("tighten_protection")).toBe(true);
    expect(isSuggestionKind("reconcile_manual_fix")).toBe(true);
    expect(isSuggestionKind("investigate_incident")).toBe(true);
    expect(isSuggestionKind("reduce_fallback_rate")).toBe(true);
    expect(isSuggestionKind("review_pattern")).toBe(true);
    expect(isSuggestionKind("no_action_needed")).toBe(true);
  });
  it("rejects unknown kinds", () => {
    expect(isSuggestionKind("random")).toBe(false);
    expect(isSuggestionKind("")).toBe(false);
  });
});

describe("buildSuggestionPrompt", () => {
  it("includes entries + summaries + format instructions", () => {
    const p = buildSuggestionPrompt([entry("e1")], [sum("s1")]);
    expect(p).toContain("[e1] council");
    expect(p).toContain("[s1] all");
    expect(p).toContain("Respond with ONLY the JSON object");
    expect(p).toContain("kind>|<targetKind");
    expect(p).toContain("no_action_needed");
  });

  it("truncates long narratives", () => {
    const big = "x".repeat(500);
    const p = buildSuggestionPrompt([entry("e1", { narrative: big })], []);
    expect(p).not.toContain(big);
  });
});

describe("parseSuggestionResponse", () => {
  const ids = new Set(["e1", "e2", "s1"]);

  it("parses one valid suggestion", () => {
    const raw = JSON.stringify({
      narrative: "ignored",
      riskFactors: ["review_release|release|rel_42|85|Re-evaluate release rel_42"],
      nextActions: ["Repeat block pattern detected — see [e1] and [e2]."],
    });
    const out = parseSuggestionResponse(raw, ids);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(1);
    expect(out![0].kind).toBe("review_release");
    expect(out![0].targetKind).toBe("release");
    expect(out![0].targetId).toBe("rel_42");
    expect(out![0].confidence).toBe(85);
    expect(out![0].title).toBe("Re-evaluate release rel_42");
    expect(out![0].citations).toEqual(["e1", "e2"]);
  });

  it("parses multiple suggestions and pairs rationale by index", () => {
    const raw = JSON.stringify({
      narrative: "x",
      riskFactors: [
        "review_release|release|rel_1|80|First",
        "tighten_protection|repo|repo_x|70|Second",
      ],
      nextActions: ["First rationale [e1]", "Second rationale [e2]"],
    });
    const out = parseSuggestionResponse(raw, ids)!;
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("First");
    expect(out[1].title).toBe("Second");
    expect(out[0].citations).toEqual(["e1"]);
    expect(out[1].citations).toEqual(["e2"]);
  });

  it("handles null target fields encoded as '-'", () => {
    const raw = JSON.stringify({
      narrative: "x",
      riskFactors: ["reduce_fallback_rate|-|-|65|AI provider flaky"],
      nextActions: ["Investigate provider [s1]"],
    });
    const out = parseSuggestionResponse(raw, ids)!;
    expect(out[0].targetKind).toBeNull();
    expect(out[0].targetId).toBeNull();
  });

  it("filters fabricated citation ids", () => {
    const raw = JSON.stringify({
      narrative: "x",
      riskFactors: ["review_release|release|rel_1|80|Title"],
      nextActions: ["From [e1] and [fake] and [s1]"],
    });
    const out = parseSuggestionResponse(raw, ids)!;
    expect(out[0].citations).toEqual(["e1", "s1"]);
  });

  it("clamps confidence to [0, 100]", () => {
    const raw = JSON.stringify({
      narrative: "x",
      riskFactors: [
        "review_release|release|r1|9999|over",
        "review_release|release|r2|-50|under",
      ],
      nextActions: ["[e1]", "[e2]"],
    });
    const out = parseSuggestionResponse(raw, ids)!;
    expect(out[0].confidence).toBe(100);
    expect(out[1].confidence).toBe(0);
  });

  it("rejects suggestions with invalid kinds", () => {
    const raw = JSON.stringify({
      narrative: "x",
      riskFactors: [
        "not_a_kind|release|r1|80|Title",
        "review_release|release|r2|80|Real",
      ],
      nextActions: ["[e1]", "[e2]"],
    });
    const out = parseSuggestionResponse(raw, ids)!;
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Real");
  });

  it("rejects suggestions with too few parts", () => {
    const raw = JSON.stringify({
      narrative: "x",
      riskFactors: ["only|three|parts", "review_release|release|r1|80|Real"],
      nextActions: ["[e1]", "[e2]"],
    });
    const out = parseSuggestionResponse(raw, ids)!;
    expect(out).toHaveLength(1);
  });

  it("caps suggestions at 5", () => {
    const many: string[] = [];
    const rats: string[] = [];
    for (let i = 0; i < 10; i++) {
      many.push(`review_release|release|r${i}|50|Title ${i}`);
      rats.push(`Rationale ${i}`);
    }
    const out = parseSuggestionResponse(JSON.stringify({
      narrative: "x", riskFactors: many, nextActions: rats,
    }), ids)!;
    expect(out.length).toBe(5);
  });

  it("returns null on malformed JSON", () => {
    expect(parseSuggestionResponse("{ broken", ids)).toBeNull();
    expect(parseSuggestionResponse("", ids)).toBeNull();
  });
});

describe("buildFallbackSuggestions", () => {
  it("flags errored entries with reduce_fallback_rate", () => {
    const out = buildFallbackSuggestions([
      entry("e1", { outcome: "error" }),
      entry("e2", { outcome: "ai_generated" }),
    ], [], "no_ai");
    expect(out.outcome).toBe("fallback_rules");
    expect(out.suggestions.some((s) => s.kind === "reduce_fallback_rate")).toBe(true);
  });

  it("flags low AI availability", () => {
    const items: SuggestionContextEntry[] = [];
    for (let i = 0; i < 5; i++) {
      items.push(entry(`e${i}`, { outcome: i < 4 ? "fallback_rules" : "ai_generated" }));
    }
    const out = buildFallbackSuggestions(items, [], "x");
    expect(out.suggestions.some((s) => s.title.includes("AI availability"))).toBe(true);
  });

  it("flags repeat reasoning on the same subject (review_pattern)", () => {
    const repeats: SuggestionContextEntry[] = [
      entry("e1", { rowTargetKind: "release", rowTargetId: "rel_42" }),
      entry("e2", { rowTargetKind: "release", rowTargetId: "rel_42" }),
      entry("e3", { rowTargetKind: "release", rowTargetId: "rel_42" }),
    ];
    const out = buildFallbackSuggestions(repeats, [], "x");
    expect(out.suggestions.some((s) => s.kind === "review_pattern" && s.targetId === "rel_42")).toBe(true);
  });

  it("flags surface dominance (one engine ≥70%)", () => {
    const heavyCouncil: SuggestionContextEntry[] = [];
    for (let i = 0; i < 7; i++) heavyCouncil.push(entry(`e${i}`, { rowTargetKind: "council", rowTargetId: `c_${i}` }));
    for (let i = 0; i < 3; i++) heavyCouncil.push(entry(`t${i}`, { rowTargetKind: "triage", rowTargetId: `t_${i}` }));
    const out = buildFallbackSuggestions(heavyCouncil, [], "x");
    expect(out.suggestions.some((s) => s.kind === "review_pattern" && s.title.includes("council dominates"))).toBe(true);
  });

  it("emits no_action_needed when memory is empty", () => {
    const out = buildFallbackSuggestions([], [], "x");
    expect(out.suggestions).toHaveLength(1);
    expect(out.suggestions[0].kind).toBe("no_action_needed");
  });

  it("emits no_action_needed when nothing flags", () => {
    const clean: SuggestionContextEntry[] = [
      entry("e1", { outcome: "ai_generated" }),
      entry("e2", { outcome: "ai_generated" }),
    ];
    const out = buildFallbackSuggestions(clean, [], "x");
    expect(out.suggestions.some((s) => s.kind === "no_action_needed")).toBe(true);
  });

  it("caps at 5 suggestions", () => {
    const items: SuggestionContextEntry[] = [];
    // create 6 repeat patterns
    for (let i = 0; i < 6; i++) {
      items.push(entry(`a${i}`, { rowTargetKind: "release", rowTargetId: `r${i}` }));
      items.push(entry(`b${i}`, { rowTargetKind: "release", rowTargetId: `r${i}` }));
      items.push(entry(`c${i}`, { rowTargetKind: "release", rowTargetId: `r${i}` }));
    }
    // and some errored entries
    items.push(entry("err1", { outcome: "error" }));
    const out = buildFallbackSuggestions(items, [], "x");
    expect(out.suggestions.length).toBeLessThanOrEqual(5);
  });

  it("pins engine version", () => {
    const out = buildFallbackSuggestions([], [], "x");
    expect(out.engineVersion).toBe(PROACTIVE_SUGGESTION_ENGINE_VERSION);
  });
});

describe("generateProactiveSuggestions", () => {
  const validResp = JSON.stringify({
    narrative: "x",
    riskFactors: ["review_release|release|rel_42|85|Re-check release rel_42"],
    nextActions: ["Repeat block pattern from [e1]"],
  });

  it("returns fallback when fetcher is null", async () => {
    const out = await generateProactiveSuggestions([entry("e1")], [], null);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("no_ai_fetcher_configured");
  });

  it("returns fallback for empty context window", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validResp, modelHint: null });
    const out = await generateProactiveSuggestions([], [], fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("empty_memory");
    expect(out.suggestions[0].kind).toBe("no_action_needed");
  });

  it("returns ai_generated on valid response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validResp, modelHint: "claude-opus-4-7" });
    const out = await generateProactiveSuggestions([entry("e1")], [sum("s1")], fetcher);
    expect(out.outcome).toBe("ai_generated");
    expect(out.suggestions[0].title).toContain("rel_42");
    expect(out.modelHint).toBe("claude-opus-4-7");
  });

  it("error outcome when fetcher throws + fallback content", async () => {
    const fetcher: RationaleAiFetcher = async () => { throw new Error("api down"); };
    const out = await generateProactiveSuggestions([entry("e1")], [], fetcher);
    expect(out.outcome).toBe("error");
    expect(out.errorMessage).toContain("api down");
    expect(out.suggestions.length).toBeGreaterThan(0);
  });

  it("falls back on empty AI response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "   ", modelHint: null });
    const out = await generateProactiveSuggestions([entry("e1")], [], fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("empty_ai_response");
  });

  it("falls back on unparseable AI response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "i forgot", modelHint: null });
    const out = await generateProactiveSuggestions([entry("e1")], [], fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("unparseable_ai_response");
  });

  it("falls back when AI returns valid JSON but zero parseable suggestions", async () => {
    const fetcher: RationaleAiFetcher = async () => ({
      text: JSON.stringify({ narrative: "x", riskFactors: ["only_bad_kind|-|-|50|Title"], nextActions: ["[e1]"] }),
      modelHint: null,
    });
    const out = await generateProactiveSuggestions([entry("e1")], [], fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("unparseable_ai_response");
  });
});
