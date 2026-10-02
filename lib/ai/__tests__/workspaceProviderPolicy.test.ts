import { describe, expect, it } from "vitest";
import { normalizeWorkspaceAIProviderPolicy, resolveWorkspaceAIProviderPolicy } from "../workspaceProviderPolicy";

describe("workspace AI provider policy", () => {
  it("rejects an empty policy, mock provider, and fallback outside allowlist", () => {
    expect(normalizeWorkspaceAIProviderPolicy({ allowedProviders: [], fallbackOrder: [] })).toBeNull();
    expect(normalizeWorkspaceAIProviderPolicy({ allowedProviders: ["mock"], fallbackOrder: [] })).toBeNull();
    expect(normalizeWorkspaceAIProviderPolicy({ allowedProviders: ["groq"], fallbackOrder: ["gemini"] })).toBeNull();
  });

  it("removes disabled providers and preserves the approved fallback order", () => {
    const stored = normalizeWorkspaceAIProviderPolicy({
      allowedProviders: ["groq", "gemini"],
      fallbackOrder: ["gemini", "groq"],
    });
    expect(resolveWorkspaceAIProviderPolicy({ stored, serviceEnabled: ["groq"] }))
      .toEqual({ allowedProviders: ["groq"], fallbackOrder: ["groq"] });
  });

  it("uses all service-enabled providers when a workspace has no policy yet", () => {
    expect(resolveWorkspaceAIProviderPolicy({ stored: null, serviceEnabled: ["groq", "gemini"] }))
      .toEqual({ allowedProviders: ["groq", "gemini"], fallbackOrder: ["groq", "gemini"] });
  });
});
