/**
 * Vitest unit tests for the AI model registry.
 */

import { describe, it, expect } from "vitest";
import { defaultModelFor, isKnownModel, listModels, PROVIDER_PRIORITY } from "../AIModelRegistry";

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
    expect(defaultModelFor("ollama")).toBe("llama3.2");
    expect(defaultModelFor("mock")).toBe("mock-v1");
  });

  it("isKnownModel narrows correctly", () => {
    expect(isKnownModel("groq", "llama-3.1-8b-instant")).toBe(true);
    expect(isKnownModel("groq", "definitely-not-a-real-model")).toBe(false);
  });

  it("PROVIDER_PRIORITY lists exactly the 9 providers in the documented order", () => {
    expect(PROVIDER_PRIORITY).toEqual([
      "github_models", "ollama", "lm_studio", "groq",
      "hugging_face", "openrouter", "gemini", "cloudflare", "mock",
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
