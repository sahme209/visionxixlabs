import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ consume: vi.fn(), discard: vi.fn(), text: vi.fn(), record: vi.fn(), dispatch: Object.freeze({}) }));
vi.mock("@/lib/billing/governedExtractAdmission", () => ({ consumeGovernedTextAdmission: m.consume, discardGovernedAIAdmission: m.discard, consumeGovernedExtractAdmission: vi.fn() }));
vi.mock("../providers/VercelGatewayProvider", () => ({ VercelGatewayProvider: class {
  name = "vercel_gateway"; defaultModel = "anthropic/claude-sonnet-5";
  isConfigured() { return true; } generateTextOnce = m.text;
} }));
import { AIProviderManager } from "../AIProviderManager";
beforeEach(() => { vi.clearAllMocks(); m.consume.mockReturnValue({ record: m.record, codingDispatch: m.dispatch, assertCurrentPolicy: async () => {} }); m.text.mockResolvedValue({ text: "synthetic" }); });
it("pins final effective model before consuming exact text authority and forwards the private dispatch", async () => {
  const secret = `ghp_${"a".repeat(36)}`;
  const opts = { organizationId: "org", correlationId: "correlation", model: "service-default", modelSelections: { vercel_gateway: "anthropic/claude-sonnet-5" }, maxTokens: 4096, temperature: 0.2, system: `System ${secret}` } as const;
  const admission = {} as never;
  await new AIProviderManager().generateTextWithAdmission(`Inspect ${secret}`, opts, admission);
  expect(m.consume).toHaveBeenCalledWith(admission, expect.objectContaining({ model: "anthropic/claude-sonnet-5", maxTokens: 4096, temperature: 0.2 }), { prompt: expect.stringContaining("REDACTED"), system: expect.stringContaining("REDACTED") });
  expect(m.consume.mock.calls[0][2].prompt).not.toContain(secret);
  expect(m.consume.mock.calls[0][2].system).not.toContain(secret);
  expect(m.text).toHaveBeenCalledOnce();
  expect(m.text).toHaveBeenCalledWith(m.consume.mock.calls[0][2].prompt, expect.objectContaining({ model: "anthropic/claude-sonnet-5", system: m.consume.mock.calls[0][2].system, codingDispatch: m.dispatch }));
  expect(m.consume.mock.invocationCallOrder[0]).toBeLessThan(m.text.mock.invocationCallOrder[0]);
  expect(m.record).toHaveBeenCalledWith({ text: "synthetic" });
});
it("never invokes the provider or recorder after exact authority refusal", async () => {
  m.consume.mockImplementation(() => { throw new Error("exact request changed"); });
  await expect(new AIProviderManager().generateTextWithAdmission("changed", { organizationId: "org", correlationId: "corr" }, {} as never)).rejects.toThrow("exact request changed");
  expect(m.text).not.toHaveBeenCalled(); expect(m.record).not.toHaveBeenCalled();
});

it.each([undefined, ""])("preserves absent versus empty canonical system at both boundaries (%s)", async system => {
  await new AIProviderManager().generateTextWithAdmission("prompt", { organizationId: "org", correlationId: "corr", system }, {} as never);
  const payload=m.consume.mock.calls[0][2],options=m.text.mock.calls[0][1];
  if(system===undefined){expect(Object.hasOwn(payload,"system")).toBe(false);expect(Object.hasOwn(options,"system")).toBe(false);}
  else{expect(payload.system).toBe("");expect(options.system).toBe("");}
});

it.each(["payload", "model", "provider"])("burns admission on %s preparation failure without any provider or ledger effect", async failure => {
  const admission={} as never;
  const options={ organizationId:"org",correlationId:"corr",...(failure==="model"?{model:"spacexai/grok-4.20-multi-agent"}:{}),...(failure==="provider"?{only:"openai" as const}:{}) };
  const prompt=failure==="payload"?"x".repeat(131073):"prompt";
  await expect(new AIProviderManager().generateTextWithAdmission(prompt, options, admission)).rejects.toThrow();
  expect(m.discard).toHaveBeenCalledExactlyOnceWith(admission);
  expect(m.consume).not.toHaveBeenCalled();expect(m.text).not.toHaveBeenCalled();expect(m.record).not.toHaveBeenCalled();
});
