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
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.AI_GATEWAY_MODEL;
    _resetAIProviderManagerForTests();
  });

  it("includes only the configured service Gateway without exposing credentials", () => {
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
    process.env.AI_GATEWAY_MODEL = "test/model";
    _resetAIProviderManagerForTests();

    const rows = listDesktopAIProviderAvailability();

    expect(rows).toEqual([{ provider: "vercel_gateway", configured: true, defaultModel: "test/model" }]);
    expect(JSON.stringify(rows)).not.toContain("test-gateway-key");
  });

  it("reports disabled routes when a service has no configured provider key", () => {
    const rows = listDesktopAIProviderAvailability();

    expect(rows).toEqual([{ provider: "vercel_gateway", configured: false, defaultModel: "service-default" }]);
  });
});
