import { describe, expect, it } from "vitest";
import { XAIProvider } from "../providers/XAIProvider";

describe("XAIProvider", () => {
  it("stays unavailable until the service supplies an xAI key", () => {
    expect(new XAIProvider({}).isConfigured()).toBe(false);
    expect(new XAIProvider({ apiKey: "server-managed-test-key" }).isConfigured()).toBe(true);
  });

  it("uses the documented Grok default", () => {
    const provider = new XAIProvider({});
    expect(provider.defaultModel).toBe("grok-4.7");
  });
});
