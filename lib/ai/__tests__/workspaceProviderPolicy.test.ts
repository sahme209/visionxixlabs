import { describe, expect, it } from "vitest";
import { normalizeWorkspaceAIProviderPolicy, resolveWorkspaceAIProviderPolicy } from "../workspaceProviderPolicy";

describe("workspace AI provider policy", () => {
  it("rejects an empty policy, mock provider, and fallback outside allowlist", () => {
    expect(normalizeWorkspaceAIProviderPolicy({ allowedProviders: [], fallbackOrder: [] })).toBeNull();
    expect(normalizeWorkspaceAIProviderPolicy({ allowedProviders: ["mock"], fallbackOrder: [] })).toBeNull();
    expect(normalizeWorkspaceAIProviderPolicy({ allowedProviders: ["groq"], fallbackOrder: ["gemini"] })).toBeNull();
    expect(normalizeWorkspaceAIProviderPolicy({ allowedProviders: ["groq"], modelSelections: { groq: "not-a-model" }, fallbackOrder: [] })).toBeNull();
  });

  it("removes disabled providers and preserves the approved fallback order", () => {
    const stored = normalizeWorkspaceAIProviderPolicy({
      allowedProviders: ["groq", "gemini"],
      modelSelections: { groq: "llama-3.1-70b-versatile", gemini: "gemini-2.5-flash" },
      fallbackOrder: ["gemini", "groq"],
    });
    expect(resolveWorkspaceAIProviderPolicy({ stored, serviceEnabled: ["groq"] }))
      .toEqual({ allowedProviders: ["groq"], modelSelections: { groq: "llama-3.1-70b-versatile" }, fallbackOrder: ["groq"] });
  });

  it("uses all service-enabled providers when a workspace has no policy yet", () => {
    expect(resolveWorkspaceAIProviderPolicy({ stored: null, serviceEnabled: ["groq", "gemini"] }))
      .toEqual({ allowedProviders: ["groq", "gemini"], modelSelections: { groq: "llama-3.1-70b-versatile", gemini: "gemini-2.5-flash" }, fallbackOrder: ["groq", "gemini"] });
  });
});
