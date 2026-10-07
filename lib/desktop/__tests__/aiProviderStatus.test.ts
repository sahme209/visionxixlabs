import { describe, expect, it } from "vitest";
import { normalizeAiProviderStatus } from "../../../desktop/src/lib/aiProviderStatus";

describe("normalizeAiProviderStatus", () => {
  it("accepts the complete desktop provider response", () => {
    expect(normalizeAiProviderStatus({
      providers: [{ provider: "openai", models: [{ id: "gpt-5", label: "GPT-5", tier: "frontier" }] }],
      policy: {
        enabled: true,
        allowedProviders: ["openai"],
        modelSelections: { openai: "gpt-5" },
        fallbackOrder: ["openai"],
      },
    }))?.toEqual({
      providers: [{ provider: "openai", models: [{ id: "gpt-5", label: "GPT-5", tier: "frontier" }] }],
      policy: {
        enabled: true,
        allowedProviders: ["openai"],
        modelSelections: { openai: "gpt-5" },
        fallbackOrder: ["openai"],
      },
    });
  });

  it.each([
    null,
    {},
    { providers: null, policy: {} },
    { providers: [{ provider: "openai" }], policy: {} },
    { providers: [], policy: { enabled: true, allowedProviders: "openai", modelSelections: {}, fallbackOrder: [] } },
    { providers: [], policy: { enabled: true, allowedProviders: [], modelSelections: { openai: 42 }, fallbackOrder: [] } },
  ])("rejects malformed data without throwing", (value) => {
    expect(normalizeAiProviderStatus(value)).toBeNull();
  });
});
