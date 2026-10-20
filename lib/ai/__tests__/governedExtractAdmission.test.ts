import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ reserve: vi.fn(), claim: vi.fn(), write: vi.fn(), transaction: vi.fn(), extract: vi.fn(), ordinaryExtract: vi.fn(), text: vi.fn(), ordinaryText: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("@/lib/billing/aiCreditReservation", () => ({ reserveAICredits: m.reserve, claimLegacyAICreditDispatch: m.claim }));
vi.mock("@/lib/billing/recordAIUsageEvent", () => ({ recordAIUsageEvent: m.write, recordReservedAIUsageEventV2: vi.fn() }));
vi.mock("../providers/VercelGatewayProvider", async importOriginal => ({ ...await importOriginal<typeof import("../providers/VercelGatewayProvider")>(), VercelGatewayProvider: class {
  name = "vercel_gateway";
  defaultModel = "vendor/model";
  isConfigured() { return true; }
  generateStructuredTextOnce = m.extract;
  extractStructuredData = m.ordinaryExtract;
  generateTextOnce = m.text;
  generateText = m.ordinaryText;
} }));

import { AIProviderManager } from "../AIProviderManager";
import { admitAIText, admitGovernedExtract } from "@/lib/billing/governedExtractAdmission";

const scope = { organizationId: "org", userId: "member", correlationId: "request:0" };
const response = { provider: "vercel_gateway", model: "vendor/model", gatewayGenerationId: "generation", latencyMs: 1, text: '{"action":"respond"}', usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 } };
const structured = { provider: response.provider, model: response.model, gatewayGenerationId: response.gatewayGenerationId, latencyMs: 1, data: { action: "respond" }, raw: response.text, usage: response.usage };
describe("actual manager admitted extraction boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold" } });
    m.claim.mockResolvedValue(true);
    m.transaction.mockImplementation(async fn => fn({
      $queryRawUnsafe: vi.fn(async () => [{ id: "hold", organizationId: "org", status: "dispatch_unknown", usageEventId: null }]),
      usageEvent: { findUnique: vi.fn(async () => null), create: vi.fn() },
      aIUsageReservation: { updateMany: vi.fn(async () => ({ count: 1 })) },
    }));
    m.write.mockResolvedValue({ recorded: true, usageEventId: "usage", pendingSettlement: true });
    m.extract.mockResolvedValue(response);
    m.ordinaryExtract.mockResolvedValue(structured);
    m.text.mockResolvedValue(response); m.ordinaryText.mockResolvedValue(response);
  });
  it("dispatches once only after durable claim, with one ledger writer and no capability in SDK options", async () => {
    const mgr = new AIProviderManager();
    const capability = await admitGovernedExtract(scope);
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).resolves.toEqual(structured);
    expect(m.extract).toHaveBeenCalledTimes(1); expect(m.write).toHaveBeenCalledTimes(1);
    expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(m.extract.mock.invocationCallOrder[0]);
    expect(m.extract.mock.calls[0][2]).toEqual({ ...scope, model: undefined });
    expect(m.write.mock.calls[0]).toHaveLength(2); // existing producer with the transactional create-only writer
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).rejects.toThrow();
    expect(m.extract).toHaveBeenCalledTimes(1);
  });
  it("accounts for an invalid JSON envelope before parsing, with repair requiring a new hold", async () => {
    const mgr = new AIProviderManager();
    m.extract.mockResolvedValue({ ...response, text: "not JSON" });
    const capability = await admitGovernedExtract(scope);
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).rejects.toThrow();
    expect(m.write).toHaveBeenCalledTimes(1);
    await expect(mgr.extractStructuredDataWithAdmission("repair", "schema", scope, capability)).rejects.toThrow();
    expect(m.extract).toHaveBeenCalledTimes(1);
    m.extract.mockResolvedValue({ ...response, gatewayGenerationId: "repair-generation" });
    const repairScope = { ...scope, correlationId: scope.correlationId + ":repair" };
    await mgr.extractStructuredDataWithAdmission("repair", "schema", repairScope, await admitGovernedExtract(repairScope));
    expect(m.reserve).toHaveBeenCalledTimes(2); expect(m.extract).toHaveBeenCalledTimes(2); expect(m.write).toHaveBeenCalledTimes(2);
  });
  it("forged, cross-tenant or scope-mismatched admissions cannot reach the SDK", async () => {
    const mgr = new AIProviderManager();
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, {} as never)).rejects.toThrow();
    const capability = await admitGovernedExtract(scope);
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", { ...scope, organizationId: "foreign" }, capability)).rejects.toThrow();
    expect(m.extract).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
  });
  it("a concurrent same-key replay cannot dispatch a second call", async () => {
    m.reserve.mockResolvedValueOnce({ ok: true, reused: false, reservation: { id: "hold" } }).mockResolvedValueOnce({ ok: true, reused: true, reservation: { id: "hold" } });
    const attempts = await Promise.allSettled([admitGovernedExtract(scope), admitGovernedExtract(scope)]);
    const accepted = attempts.filter((a): a is PromiseFulfilledResult<Awaited<ReturnType<typeof admitGovernedExtract>>> => a.status === "fulfilled");
    expect(accepted).toHaveLength(1);
    await new AIProviderManager().extractStructuredDataWithAdmission("prompt", "schema", scope, accepted[0].value);
    expect(m.claim).toHaveBeenCalledTimes(1); expect(m.extract).toHaveBeenCalledTimes(1); expect(m.write).toHaveBeenCalledTimes(1);
  });
  it.each(["sdk", "usage", "writer"])("%s uncertainty cannot redispatch or release a claimed hold", async kind => {
    const mgr = new AIProviderManager();
    if (kind === "sdk") m.extract.mockRejectedValue(new Error("unknown provider outcome"));
    if (kind === "usage") m.extract.mockResolvedValue({ ...response, usage: undefined });
    if (kind === "writer") m.write.mockResolvedValue({ recorded: false });
    const capability = await admitGovernedExtract(scope);
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).rejects.toThrow();
    await expect(mgr.extractStructuredDataWithAdmission("prompt", "schema", scope, capability)).rejects.toThrow();
    expect(m.extract).toHaveBeenCalledTimes(1);
  });
  it("ordinary manager callers retain the existing eager writer without reservation flags", async () => {
    await expect(new AIProviderManager().extractStructuredData("prompt", "schema", scope)).resolves.toEqual(structured);
    expect(m.reserve).not.toHaveBeenCalled(); expect(m.claim).not.toHaveBeenCalled();
    expect(m.write).toHaveBeenCalledTimes(1); expect(m.write.mock.calls[0]).toHaveLength(1);
  });
  it("the generic admitted text lane dispatches once and writes once before returning data", async () => {
    const mgr = new AIProviderManager(), admitted = await admitAIText({ ...scope, idempotencyKey: "generic_request_123456" });
    if (!admitted.ok) throw new Error("expected admission");
    await expect(mgr.generateTextWithAdmission("prompt", scope, admitted.admission)).resolves.toEqual(response);
    expect(m.text).toHaveBeenCalledOnce(); expect(m.write).toHaveBeenCalledOnce();
    expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ metadata: { route: "api/ai/generate" } }), expect.anything());
    expect(m.ordinaryText).not.toHaveBeenCalled(); expect(m.extract).not.toHaveBeenCalled();
    await expect(mgr.generateTextWithAdmission("prompt", scope, admitted.admission)).rejects.toThrow();
    expect(m.text).toHaveBeenCalledOnce();
  });
  it.each(["sdk", "usage", "writer"])("generic admitted text %s failure does not allow redispatch", async kind => {
    const mgr = new AIProviderManager(), admitted = await admitAIText({ ...scope, idempotencyKey: "generic_request_123456" });
    if (!admitted.ok) throw new Error("expected admission");
    if (kind === "sdk") m.text.mockRejectedValue(new Error("unknown outcome"));
    if (kind === "usage") m.text.mockResolvedValue({ ...response, usage: undefined });
    if (kind === "writer") m.write.mockResolvedValue({ recorded: false });
    await expect(mgr.generateTextWithAdmission("prompt", scope, admitted.admission)).rejects.toThrow();
    await expect(mgr.generateTextWithAdmission("prompt", scope, admitted.admission)).rejects.toThrow();
    expect(m.text).toHaveBeenCalledOnce();
  });
  it("ordinary text generation remains unrelated to the admitted route's accounting", async () => {
    await expect(new AIProviderManager().generateText("prompt", scope)).resolves.toEqual(response);
    expect(m.reserve).not.toHaveBeenCalled(); expect(m.claim).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
    expect(m.ordinaryText).toHaveBeenCalledOnce(); expect(m.text).not.toHaveBeenCalled();
  });
});
