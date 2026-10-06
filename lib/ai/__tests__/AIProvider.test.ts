import { describe, expect, it } from "vitest";
import { isAIProviderName } from "../AIProvider";

describe("AI provider vocabulary", () => {
  it("accepts only registered provider names", () => {
    expect(isAIProviderName("github_models")).toBe(true);
    expect(isAIProviderName("groq")).toBe(true);
    expect(isAIProviderName("xai")).toBe(true);
    expect(isAIProviderName("mock")).toBe(true);
    expect(isAIProviderName("gpt")).toBe(false);
    expect(isAIProviderName("__proto__")).toBe(false);
  });
});
