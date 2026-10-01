import { beforeEach, describe, expect, it } from "vitest";
import { _resetAIProviderManagerForTests } from "../AIProviderManager";
import { listDesktopAIProviderAvailability } from "../desktopProviderAvailability";

describe("listDesktopAIProviderAvailability", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.MODEL_NAME;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    _resetAIProviderManagerForTests();
  });

  it("includes the service-routed GPT and Claude families without exposing credentials", () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_MODEL = "gpt-test";
    process.env.ANTHROPIC_MODEL = "claude-test";

    const rows = listDesktopAIProviderAvailability();

    expect(rows).toContainEqual({ provider: "openai", configured: true, defaultModel: "gpt-test" });
    expect(rows).toContainEqual({ provider: "anthropic", configured: true, defaultModel: "claude-test" });
    expect(JSON.stringify(rows)).not.toContain("test-openai-key");
    expect(JSON.stringify(rows)).not.toContain("test-anthropic-key");
  });

  it("reports disabled routes when a service has no configured provider key", () => {
    const rows = listDesktopAIProviderAvailability();

    expect(rows).toContainEqual({ provider: "openai", configured: false, defaultModel: "gpt-4o" });
    expect(rows).toContainEqual({ provider: "anthropic", configured: false, defaultModel: "claude-sonnet-4-20250514" });
  });
});
