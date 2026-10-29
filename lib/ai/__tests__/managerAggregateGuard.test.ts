import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderManager } from "../AIProviderManager";
import { VercelGatewayProvider } from "../providers/VercelGatewayProvider";
import type { AIRequestOptions } from "../AIProvider";
import { consumeGovernedTextAdmission, consumeGovernedExtractAdmission } from "@/lib/billing/governedExtractAdmission";
import type { GovernedAIAdmission } from "@/lib/billing/governedExtractAdmission";

vi.mock("@/lib/billing/governedExtractAdmission", () => ({
  consumeGovernedTextAdmission: vi.fn(() => ({ record: vi.fn() })),
  consumeGovernedExtractAdmission: vi.fn(() => ({ record: vi.fn() })),
}));
const blocked = "spacexai/grok-4.20-multi-agent";
const response = { text: '{"action":"respond"}', provider: "vercel_gateway" as const, model: "vendor/safe", latencyMs: 0 };
const admission = {} as GovernedAIAdmission;
let calls = vi.fn<(...args: unknown[]) => void>();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic");
  vi.stubEnv("AI_GATEWAY_MODEL", blocked);
  calls = vi.fn<(...args: unknown[]) => void>();
  for (const method of ["generateText", "summarize", "classify", "extractStructuredData", "generateTextOnce", "generateStructuredTextOnce", "healthCheck"] as const) {
    vi.spyOn(VercelGatewayProvider.prototype, method).mockImplementation(async (...args: unknown[]) => { calls(...args); return response as never; });
  }
  for (const method of ["streamText", "streamTextOnce"] as const) {
    vi.spyOn(VercelGatewayProvider.prototype, method).mockImplementation(async function* (...args: unknown[]) { calls(...args); yield { text: "", done: true, response } as never; });
  }
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const paths = {
  generate: (m: AIProviderManager, o?: AIRequestOptions) => m.generateText("p", o),
  summarize: (m: AIProviderManager, o?: AIRequestOptions) => m.summarize("p", o),
  classify: (m: AIProviderManager, o?: AIRequestOptions) => m.classify("p", ["a"], o),
  extract: (m: AIProviderManager, o?: AIRequestOptions) => m.extractStructuredData("p", "{}", o),
  stream: async (m: AIProviderManager, o?: AIRequestOptions) => { for await (const _ of m.streamText("p", o)) {} },
  admittedGenerate: (m: AIProviderManager, o?: AIRequestOptions) => m.generateTextWithAdmission("p", o ?? {}, admission),
  admittedStream: async (m: AIProviderManager, o?: AIRequestOptions) => { for await (const _ of m.streamTextWithAdmission("p", o ?? {}, admission)) {} },
  admittedExtract: (m: AIProviderManager, o?: AIRequestOptions) => m.extractStructuredDataWithAdmission("p", "{}", o ?? {}, admission),
  admittedExtractStream: (m: AIProviderManager, o?: AIRequestOptions) => m.extractStructuredDataStreamingWithAdmission("p", "{}", o ?? {}, admission, vi.fn()),
};
describe("manager aggregate output boundary", () => {
  for (const [name, run] of Object.entries(paths)) {
    it.each([undefined, { model: "service-default" }, { modelSelections: { vercel_gateway: blocked } }, { model: blocked }])(`${name} refuses unsupported effective model before provider invocation (%j)`, async options => {
      await run(new AIProviderManager(), options).catch(() => undefined);
      expect(calls).not.toHaveBeenCalled();
      expect(consumeGovernedTextAdmission).not.toHaveBeenCalled();
      expect(consumeGovernedExtractAdmission).not.toHaveBeenCalled();
    });
  }
  it("refuses inference-based health probes for unsupported default", async () => {
    const rows = await new AIProviderManager().healthCheckAll();
    expect(rows[0].ok).toBe(false); expect(calls).not.toHaveBeenCalled();
  });
  it.each(["vendor/safe", "vmc/private"])("preserves concrete override %s over unsupported default", async model => {
    await new AIProviderManager().generateText("p", { model, modelSelections: { vercel_gateway: blocked } });
    expect(calls).toHaveBeenCalledWith("p", expect.objectContaining({ model }));
  });
  it.each(["vendor/safe", "vmc/private"])("consumes admitted text authority once before dispatch for %s", async model => {
    for (const run of [paths.admittedGenerate, paths.admittedStream]) {
      vi.clearAllMocks();
      const options = { model, organizationId: "org", correlationId: "exact-request" };
      await run(new AIProviderManager(), options);
      expect(consumeGovernedTextAdmission).toHaveBeenCalledExactlyOnceWith(admission, options);
      expect(calls).toHaveBeenCalledTimes(1);
      expect(vi.mocked(consumeGovernedTextAdmission).mock.invocationCallOrder[0]).toBeLessThan(calls.mock.invocationCallOrder[0]);
    }
  });
  it("pins an ordinary managed default to its checked model", async () => {
    vi.stubEnv("AI_GATEWAY_MODEL", "vendor/safe");
    await new AIProviderManager().generateText("p", { model: "service-default" });
    expect(calls).toHaveBeenCalledWith("p", expect.objectContaining({ model: "vendor/safe" }));
  });
});
