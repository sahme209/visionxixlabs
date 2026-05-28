import { describe, expect, it } from "vitest";
import {
  askAgiMemory,
  buildChatFallback,
  buildChatPrompt,
  isValidQuestion,
  MEMORY_CHAT_ENGINE_VERSION,
  parseChatResponse,
  type ChatContextEntry,
  type ChatContextSummary,
  type ChatInput,
} from "../aiMemoryChatEngine";
import type { RationaleAiFetcher } from "../aiRationaleEnricherEngine";

const NOW_ISO = "2026-05-28T12:00:00Z";

function entry(id: string, overrides: Partial<ChatContextEntry> = {}): ChatContextEntry {
  return {
    citationId: id,
    targetKind: "council",
    targetId: `c_${id}`,
    narrative: `Council blocked deploy ${id}.`,
    outcome: "ai_generated",
    generatedAtIso: NOW_ISO,
    ...overrides,
  };
}

function summary(id: string, overrides: Partial<ChatContextSummary> = {}): ChatContextSummary {
  return {
    citationId: id,
    targetKind: null,
    narrative: `Meta-summary ${id} covering recent activity.`,
    generatedAtIso: NOW_ISO,
    ...overrides,
  };
}

function input(overrides: Partial<ChatInput> = {}): ChatInput {
  return {
    question: "Why did the council block v3.4.1?",
    entries: [entry("e1"), entry("e2")],
    summaries: [summary("s1")],
    ...overrides,
  };
}

describe("isValidQuestion", () => {
  it("accepts a normal question", () => {
    expect(isValidQuestion("Why did we block?")).toBe(true);
  });
  it("rejects too-short input", () => {
    expect(isValidQuestion("hi")).toBe(false);
    expect(isValidQuestion("")).toBe(false);
  });
  it("rejects non-strings", () => {
    expect(isValidQuestion(null)).toBe(false);
    expect(isValidQuestion(42)).toBe(false);
    expect(isValidQuestion({ q: "x" })).toBe(false);
  });
  it("rejects too-long input", () => {
    expect(isValidQuestion("x".repeat(501))).toBe(false);
  });
  it("trims when measuring length", () => {
    expect(isValidQuestion("    a    ")).toBe(false);
    expect(isValidQuestion("    why    ")).toBe(false);
    expect(isValidQuestion("    why?    ")).toBe(true);
  });
});

describe("buildChatPrompt", () => {
  it("includes question, entries, and summaries", () => {
    const p = buildChatPrompt(input());
    expect(p).toContain("Operator question: Why did the council block v3.4.1?");
    expect(p).toContain("[e1] council");
    expect(p).toContain("[s1] all");
    expect(p).toContain("Respond with ONLY the JSON object");
  });

  it("truncates long entry/summary narratives", () => {
    const big = "x".repeat(500);
    const p = buildChatPrompt({
      question: "describe the recent reasoning",
      entries: [entry("e1", { narrative: big })],
      summaries: [summary("s1", { narrative: big })],
    });
    expect(p).not.toContain(big);
  });

  it("emits empty entry / summary sections cleanly", () => {
    const p = buildChatPrompt({
      question: "anything?",
      entries: [],
      summaries: [],
    });
    expect(p).toContain("Recent rationale entries (newest first):");
    expect(p).toContain("Recent meta-summaries (newest first):");
  });
});

describe("parseChatResponse", () => {
  const ids = new Set(["e1", "e2", "s1"]);

  it("parses valid answer with citations", () => {
    const out = parseChatResponse(JSON.stringify({
      answer: "Council blocked because of two blocking violations.",
      citations: ["e1", "e2"],
    }), ids);
    expect(out).not.toBeNull();
    expect(out!.answer).toContain("blocked");
    expect(out!.citations).toEqual(["e1", "e2"]);
  });

  it("extracts JSON wrapped in prose", () => {
    const wrapped = `Sure thing!\n${JSON.stringify({ answer: "x.", citations: ["e1"] })}\nLet me know if you want detail.`;
    const out = parseChatResponse(wrapped, ids);
    expect(out).not.toBeNull();
  });

  it("filters out fabricated citation ids", () => {
    const out = parseChatResponse(JSON.stringify({
      answer: "Yes.",
      citations: ["e1", "fake_id", "e2"],
    }), ids);
    expect(out!.citations).toEqual(["e1", "e2"]);
  });

  it("dedupes citations", () => {
    const out = parseChatResponse(JSON.stringify({
      answer: "Yes.",
      citations: ["e1", "e1", "e1"],
    }), ids);
    expect(out!.citations).toEqual(["e1"]);
  });

  it("caps citations at 10", () => {
    const bigIds = new Set<string>();
    for (let i = 0; i < 20; i++) bigIds.add(`e${i}`);
    const out = parseChatResponse(JSON.stringify({
      answer: "y.",
      citations: Array.from(bigIds),
    }), bigIds);
    expect(out!.citations.length).toBe(10);
  });

  it("accepts empty citations array", () => {
    const out = parseChatResponse(JSON.stringify({ answer: "I cannot answer from this context.", citations: [] }), ids);
    expect(out!.citations).toEqual([]);
  });

  it("rejects empty / non-string / non-array fields", () => {
    expect(parseChatResponse(JSON.stringify({ answer: "", citations: ["e1"] }), ids)).toBeNull();
    expect(parseChatResponse(JSON.stringify({ answer: "x", citations: "e1" }), ids)).toBeNull();
    expect(parseChatResponse(JSON.stringify({ citations: ["e1"] }), ids)).toBeNull();
  });

  it("rejects non-JSON input", () => {
    expect(parseChatResponse("no json here", ids)).toBeNull();
    expect(parseChatResponse("", ids)).toBeNull();
    expect(parseChatResponse("{ malformed", ids)).toBeNull();
  });

  it("skips non-string citation entries", () => {
    const out = parseChatResponse(JSON.stringify({
      answer: "x.",
      citations: ["e1", 42, null, "e2"],
    }), ids);
    expect(out!.citations).toEqual(["e1", "e2"]);
  });
});

describe("buildChatFallback", () => {
  it("narrates an empty memory state", () => {
    const out = buildChatFallback({ question: "anything?", entries: [], summaries: [] }, "no_ai");
    expect(out.outcome).toBe("fallback_rules");
    expect(out.answer).toContain("no AGI memory");
    expect(out.engineVersion).toBe(MEMORY_CHAT_ENGINE_VERSION);
  });

  it("narrates a populated-but-no-AI state", () => {
    const out = buildChatFallback(input(), "no_ai");
    expect(out.answer).toContain("2 rationale entries");
    expect(out.answer).toContain("1 meta-summary");
    expect(out.citations).toEqual([]);
  });
});

describe("askAgiMemory", () => {
  const validResp = JSON.stringify({
    answer: "Council blocked v3.4.1 because of two blocking policy violations and a recent failed release.",
    citations: ["e1", "e2"],
  });

  it("returns fallback when fetcher is null", async () => {
    const out = await askAgiMemory(input(), null);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("no_ai_fetcher_configured");
  });

  it("returns fallback when question is invalid", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validResp, modelHint: "claude-opus-4-7" });
    const out = await askAgiMemory(input({ question: "hi" }), fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("invalid_question");
    expect(out.answer).toContain("too short");
  });

  it("returns fallback when memory is empty", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validResp, modelHint: null });
    const out = await askAgiMemory(input({ entries: [], summaries: [] }), fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("empty_memory");
  });

  it("returns ai_generated with filtered citations on valid response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validResp, modelHint: "claude-opus-4-7" });
    const out = await askAgiMemory(input(), fetcher);
    expect(out.outcome).toBe("ai_generated");
    expect(out.answer).toContain("blocked");
    expect(out.citations).toEqual(["e1", "e2"]);
    expect(out.modelHint).toBe("claude-opus-4-7");
  });

  it("returns error outcome when fetcher throws", async () => {
    const fetcher: RationaleAiFetcher = async () => { throw new Error("api down"); };
    const out = await askAgiMemory(input(), fetcher);
    expect(out.outcome).toBe("error");
    expect(out.errorMessage).toContain("api down");
    expect(out.answer.length).toBeGreaterThan(0);
  });

  it("falls back on empty AI response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "   ", modelHint: null });
    const out = await askAgiMemory(input(), fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("empty_ai_response");
  });

  it("falls back on unparseable AI response", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: "i forgot the json sorry", modelHint: null });
    const out = await askAgiMemory(input(), fetcher);
    expect(out.outcome).toBe("fallback_rules");
    expect(out.errorMessage).toBe("unparseable_ai_response");
  });

  it("filters fabricated citations even on ai_generated path", async () => {
    const fetcher: RationaleAiFetcher = async () => ({
      text: JSON.stringify({ answer: "It's complicated.", citations: ["e1", "fabricated", "s1"] }),
      modelHint: null,
    });
    const out = await askAgiMemory(input(), fetcher);
    expect(out.citations).toEqual(["e1", "s1"]);
  });

  it("pins MEMORY_CHAT_ENGINE_VERSION", async () => {
    const fetcher: RationaleAiFetcher = async () => ({ text: validResp, modelHint: null });
    const out = await askAgiMemory(input(), fetcher);
    expect(out.engineVersion).toBe(MEMORY_CHAT_ENGINE_VERSION);
  });
});
