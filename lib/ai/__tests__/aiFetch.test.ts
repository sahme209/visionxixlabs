/**
 * Vitest unit tests for the AI HTTP helpers — focused on the pure
 * parsing + classification utilities (no real network).
 */

import { describe, it, expect } from "vitest";
import { classifyHttpError, extractJsonBlock, safeJson } from "../aiFetch";
import { AIProviderError } from "../AIProvider";

describe("aiFetch.classifyHttpError", () => {
  it("401 / 403 → invalid_key, not retryable", () => {
    const a = classifyHttpError({ provider: "groq", status: 401, latencyMs: 5 });
    const b = classifyHttpError({ provider: "groq", status: 403, latencyMs: 5 });
    expect(a).toBeInstanceOf(AIProviderError);
    expect(a.kind).toBe("invalid_key");
    expect(a.retryable).toBe(false);
    expect(b.kind).toBe("invalid_key");
  });

  it("404 → model_unavailable", () => {
    const e = classifyHttpError({ provider: "groq", status: 404, latencyMs: 5 });
    expect(e.kind).toBe("model_unavailable");
  });

  it("429 → rate_limited, retryable", () => {
    const e = classifyHttpError({ provider: "groq", status: 429, latencyMs: 5 });
    expect(e.kind).toBe("rate_limited");
    expect(e.retryable).toBe(true);
  });

  it("500+ → network, retryable", () => {
    const e = classifyHttpError({ provider: "groq", status: 503, latencyMs: 5 });
    expect(e.kind).toBe("network");
    expect(e.retryable).toBe(true);
  });

  it("other 4xx → bad_response", () => {
    const e = classifyHttpError({ provider: "groq", status: 418, latencyMs: 5 });
    expect(e.kind).toBe("bad_response");
  });
});

describe("aiFetch.safeJson", () => {
  it("returns null on invalid JSON instead of throwing", () => {
    expect(safeJson("not json")).toBeNull();
  });

  it("parses valid JSON", () => {
    expect(safeJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });
});

describe("aiFetch.extractJsonBlock", () => {
  it("strips ```json fences", () => {
    const out = extractJsonBlock("Sure!\n```json\n{\"label\":\"x\"}\n```\nthanks");
    expect(out).toBe('{"label":"x"}');
  });

  it("strips bare ``` fences", () => {
    const out = extractJsonBlock("```\n[1,2,3]\n```");
    expect(out).toBe("[1,2,3]");
  });

  it("returns the first balanced object when no fence", () => {
    const out = extractJsonBlock('the answer is {"a":1,"b":{"c":2}} I think');
    expect(out).toBe('{"a":1,"b":{"c":2}}');
  });

  it("returns the first balanced array when no fence", () => {
    const out = extractJsonBlock('here: [1,[2,3],4] right?');
    expect(out).toBe('[1,[2,3],4]');
  });

  it("returns trimmed input when no brace at all", () => {
    expect(extractJsonBlock("   hello   ")).toBe("hello");
  });
});
