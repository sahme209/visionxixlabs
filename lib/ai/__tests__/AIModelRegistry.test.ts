/**
 * Vitest unit tests for the AI model registry.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultModelFor, isKnownModel, listModels, PROVIDER_PRIORITY } from "../AIModelRegistry";

describe("retired model IDs (2026-11-08)", () => {
  const retired = ["claude-sonnet-4-20250514", "claude-3-5-haiku-latest"];
  it("are absent from the default registry", () => {
    for (const provider of [...PROVIDER_PRIORITY, "anthropic"] as const) {
      for (const id of retired) expect(isKnownModel(provider, id)).toBe(false);
    }
    expect(defaultModelFor("anthropic")).toBe("claude-sonnet-4-6");
    expect(listModels("anthropic").map((m) => m.id)).toEqual(["claude-sonnet-4-6", "claude-haiku-4-5"]);
  });
  it("are absent from the direct Anthropic provider default and registry source", () => {
    for (const path of ["lib/ai/providers/anthropic.ts", "lib/ai/AIModelRegistry.ts"]) {
      const source = readFileSync(join(process.cwd(), path), "utf8").replace(/\/\/.*$/gm, "");
      for (const id of retired) expect(source).not.toContain(id);
    }
  });
  it("keeps the paid lane on Sonnet 5.5", () => {
    const source = readFileSync(join(process.cwd(), "lib/billing/smallSonnet55Request.ts"), "utf8");
    expect(source).toContain('SMALL_SONNET_55_MODEL = "anthropic/claude-sonnet-5.5"');
  });
});

describe("AIModelRegistry", () => {
  it("listModels returns a non-empty list for every provider", () => {
    for (const p of PROVIDER_PRIORITY) {
      const arr = listModels(p);
      expect(arr.length).toBeGreaterThan(0);
    }
  });

  it("listModels returns a copy (caller cannot mutate the registry)", () => {
    const a = listModels("github_models");
    const before = a.length;
    a.push({ id: "x", label: "X", tier: "preferred", family: "other", freeNote: "test" });
    const b = listModels("github_models");
    expect(b.length).toBe(before);
  });

  it("defaultModelFor prefers the 'preferred' tier", () => {
    expect(defaultModelFor("github_models")).toBe("openai/gpt-4o-mini");
    expect(defaultModelFor("groq")).toBe("llama-3.1-70b-versatile");
    expect(defaultModelFor("xai")).toBe("grok-4.7");
    expect(defaultModelFor("ollama")).toBe("llama3.2");
    expect(defaultModelFor("mock")).toBe("mock-v1");
  });

  it("isKnownModel narrows correctly", () => {
    expect(isKnownModel("groq", "llama-3.1-8b-instant")).toBe(true);
    expect(isKnownModel("groq", "definitely-not-a-real-model")).toBe(false);
  });

  it("PROVIDER_PRIORITY lists every supported provider in the documented order", () => {
    expect(PROVIDER_PRIORITY).toEqual([
      "vercel_gateway",
    ]);
  });

  it("every recommended model has a non-empty id + label + family", () => {
    for (const p of PROVIDER_PRIORITY) {
      for (const m of listModels(p)) {
        expect(m.id.length).toBeGreaterThan(0);
        expect(m.label.length).toBeGreaterThan(0);
        expect(m.family.length).toBeGreaterThan(0);
      }
    }
  });
});
