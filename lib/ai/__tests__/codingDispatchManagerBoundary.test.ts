import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ consume: vi.fn(), text: vi.fn(), record: vi.fn(), dispatch: Object.freeze({}) }));
vi.mock("@/lib/billing/governedExtractAdmission", () => ({ consumeGovernedTextAdmission: m.consume, consumeGovernedExtractAdmission: vi.fn() }));
vi.mock("../providers/VercelGatewayProvider", () => ({ VercelGatewayProvider: class {
  name = "vercel_gateway"; defaultModel = "anthropic/claude-sonnet-5";
  isConfigured() { return true; } generateTextOnce = m.text;
} }));
import { AIProviderManager } from "../AIProviderManager";
beforeEach(() => { vi.clearAllMocks(); m.consume.mockReturnValue({ record: m.record, codingDispatch: m.dispatch }); m.text.mockResolvedValue({ text: "synthetic" }); });
it("pins final effective model before consuming exact text authority and forwards the private dispatch", async () => {
  const secret = `ghp_${"a".repeat(36)}`;
  const opts = { organizationId: "org", correlationId: "correlation", model: "service-default", modelSelections: { vercel_gateway: "anthropic/claude-sonnet-5" }, maxTokens: 4096, temperature: 0.2, system: "system" } as const;
  const admission = {} as never;
  await new AIProviderManager().generateTextWithAdmission(`Inspect ${secret}`, opts, admission);
  expect(m.consume).toHaveBeenCalledWith(admission, expect.objectContaining({ model: "anthropic/claude-sonnet-5", maxTokens: 4096, temperature: 0.2 }), { prompt: expect.stringContaining("REDACTED"), system: "system" });
  expect(m.consume.mock.calls[0][2].prompt).not.toContain(secret);
  expect(m.text).toHaveBeenCalledOnce();
  expect(m.text).toHaveBeenCalledWith(m.consume.mock.calls[0][2].prompt, expect.objectContaining({ model: "anthropic/claude-sonnet-5", codingDispatch: m.dispatch }));
  expect(m.consume.mock.invocationCallOrder[0]).toBeLessThan(m.text.mock.invocationCallOrder[0]);
  expect(m.record).toHaveBeenCalledWith({ text: "synthetic" });
});
it("never invokes the provider or recorder after exact authority refusal", async () => {
  m.consume.mockImplementation(() => { throw new Error("exact request changed"); });
  await expect(new AIProviderManager().generateTextWithAdmission("changed", { organizationId: "org", correlationId: "corr" }, {} as never)).rejects.toThrow("exact request changed");
  expect(m.text).not.toHaveBeenCalled(); expect(m.record).not.toHaveBeenCalled();
});
