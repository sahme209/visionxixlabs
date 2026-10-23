import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ reserve: vi.fn(), release: vi.fn(), claim: vi.fn(), v2Claim: vi.fn(), write: vi.fn(), v2Write: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("../aiCreditReservation", () => ({ reserveAICredits: m.reserve, releaseAICreditReservation: m.release, claimLegacyAICreditDispatch: m.claim }));
vi.mock("../recordAIUsageEvent", () => ({ recordAIUsageEvent: m.write, recordReservedAIUsageEventV2: m.v2Write }));
vi.mock("../newTestSubscription/usageAllocationIO", () => ({ claimNewTestBillableDispatch: m.v2Claim }));

import { admitGovernedExtract, consumeGovernedExtractAdmission, governedExtractReservationKey } from "../governedExtractAdmission";

const scope = { organizationId: "org", userId: "member", correlationId: "request:0:repair" };
const result = { provider: "vercel_gateway", model: "vendor/model", gatewayGenerationId: "generation", usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 } } as const;
function transaction() {
  const tx = {
    $queryRawUnsafe: vi.fn(async () => [{ id: "hold", organizationId: "org", status: "dispatch_unknown", usageEventId: null }]),
    usageEvent: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: "usage", billingStatus: "pending" })) },
    aIUsageReservation: { updateMany: vi.fn(async (args: { where: Record<string, unknown>; data: { status: string; usageEventId: string } }) => { void args; return { count: 1 }; }) },
  };
  m.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(tx));
  return tx;
}
describe("governed extraction admission authority", () => {
  beforeEach(() => {
    vi.resetAllMocks(); transaction();
    m.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold" } });
    m.claim.mockResolvedValue(true); m.v2Claim.mockResolvedValue(true);
    m.write.mockResolvedValue({ recorded: true, usageEventId: "usage", pendingSettlement: true });
    m.v2Write.mockResolvedValue({ recorded: true, usageEventId: "usage", pendingSettlement: true });
  });
  it("domain-separates actor, organization, iteration and repair without raw correlation keys", () => {
    const key = governedExtractReservationKey(scope);
    expect(key).toMatch(/^agent_extract_[a-f0-9]{64}$/);
    expect(new Set([key, governedExtractReservationKey({ ...scope, userId: "other" }), governedExtractReservationKey({ ...scope, organizationId: "other" }), governedExtractReservationKey({ ...scope, correlationId: "request:0" })]).size).toBe(4);
  });
  it("mints only after a committed claim and consumes exactly once with immutable scope", async () => {
    const input = { ...scope };
    const capability = await admitGovernedExtract(input);
    input.organizationId = "foreign";
    expect(m.claim).toHaveBeenCalledWith(expect.anything(), scope, "hold");
    expect(() => consumeGovernedExtractAdmission(capability, { organizationId: "foreign", correlationId: scope.correlationId })).toThrow();
    // A mismatch burns authority too; it cannot later dispatch elsewhere.
    expect(() => consumeGovernedExtractAdmission(capability, scope)).toThrow();
    expect(() => consumeGovernedExtractAdmission({} as never, scope)).toThrow();
  });
  it.each(["reused", "denied", "claim_refused", "claim_error"])("never mints for %s", async kind => {
    if (kind === "reused") m.reserve.mockResolvedValue({ ok: true, reused: true, reservation: { id: "hold" } });
    if (kind === "denied") m.reserve.mockResolvedValue({ ok: false, error: "ai_credit_pool_exhausted" });
    if (kind === "claim_refused") m.claim.mockResolvedValue(false);
    if (kind === "claim_error") m.claim.mockRejectedValue(new Error("db unavailable"));
    await expect(admitGovernedExtract(scope)).rejects.toThrow();
  });
  it("does not silently lower the existing 1000-cent default for a 200-cent test Free allowance", async () => {
    const previous = process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS;
    delete process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS;
    try {
      m.reserve.mockImplementation(async (_repo, input) => input.reservedCents > 200 ? { ok: false, error: "ai_credit_pool_exhausted" } : { ok: true, reused: false, reservation: { id: "hold" } });
      await expect(admitGovernedExtract(scope)).rejects.toThrow();
      expect(m.reserve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reservedCents: 1000 }));
      expect(m.claim).not.toHaveBeenCalled(); expect(m.v2Claim).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS; else process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS = previous;
    }
  });
  it("uses the existing v2 claim and attributed writer exclusively for v2", async () => {
    m.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "hold" }, allocationPolicy: "axiom_test_anniversary_v2" });
    const capability = await admitGovernedExtract(scope);
    const authority = consumeGovernedExtractAdmission(capability, scope);
    await authority.record(result);
    expect(m.v2Claim).toHaveBeenCalledWith(expect.anything(), scope, "hold");
    expect(m.claim).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
    expect(m.v2Write).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org", triggeredBy: "member", externalUsageId: "generation" }), "hold");
    await expect(authority.record(result)).rejects.toThrow();
  });
  it("links a newly created generation and hold atomically, never using upsert reuse", async () => {
    const tx = transaction();
    m.write.mockImplementation(async (input, repository) => {
      await repository.usageEvent.upsert({ create: { organizationId: input.organizationId, externalUsageId: input.externalUsageId } });
      return { recorded: true, usageEventId: "usage", pendingSettlement: true };
    });
    const authority = consumeGovernedExtractAdmission(await admitGovernedExtract(scope), scope);
    await authority.record(result);
    expect(tx.usageEvent.create).toHaveBeenCalledWith({ data: { organizationId: "org", externalUsageId: "generation" } });
    expect(tx.aIUsageReservation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "hold", organizationId: "org", status: "dispatch_unknown", usageEventId: null }, data: { status: "pending_settlement", usageEventId: "usage" } }));
  });
  it.each(["foreign_generation", "old_same_tenant_generation", "foreign_hold", "missing_usage", "missing_generation", "write_failure", "link_failure"])("retains uncertain hold and refuses %s", async kind => {
    const tx = transaction();
    if (kind === "foreign_generation") tx.usageEvent.findUnique.mockResolvedValue({ id: "old", organizationId: "foreign" } as never);
    if (kind === "old_same_tenant_generation") tx.usageEvent.findUnique.mockResolvedValue({ id: "old", organizationId: "org", provider: result.provider, model: result.model } as never);
    if (kind === "foreign_hold") tx.$queryRawUnsafe.mockResolvedValue([{ id: "hold", organizationId: "foreign", status: "dispatch_unknown", usageEventId: null }]);
    if (kind === "write_failure") m.write.mockResolvedValue({ recorded: false });
    if (kind === "link_failure") tx.aIUsageReservation.updateMany.mockResolvedValue({ count: 0 });
    const authority = consumeGovernedExtractAdmission(await admitGovernedExtract(scope), scope);
    await expect(authority.record({ ...result, ...(kind === "missing_usage" ? { usage: undefined } : {}), ...(kind === "missing_generation" ? { gatewayGenerationId: undefined } : {}) })).rejects.toThrow();
    // No release operation is exposed in this claimed-dispatch path.
    expect(tx.aIUsageReservation.updateMany.mock.calls.every(([call]) => call.data.status === "pending_settlement")).toBe(true);
  });

it("admits a bounded approved Sonnet request with a full sized hold, leaving the legacy default intact", async () => {
  vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
  vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", "");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({data:{id:"anthropic/claude-sonnet-5",reasoning:{supports_max_tokens:true,supported_efforts:["none"]},endpoints:[{provider_name:"anthropic",status:0,max_completion_tokens:128000,supported_parameters:["max_tokens"],pricing:{prompt:"0.000002",completion:"0.00001",request:"0",internal_reasoning:"0",input_cache_write:"0.0000025"},inference_regions:[{pricing:{prompt:"0.0000022",completion:"0.000011",input_cache_write:"0.00000275"}}]}]}}), {headers:{"content-type":"application/json"}})));
  m.reserve.mockImplementation(async (_repo, input) => input.reservedCents > 200 ? {ok:false,error:"ai_credit_pool_exhausted"} : {ok:true,reused:false,reservation:{id:"hold"}});
  m.claim.mockResolvedValue(true);
  try {
    await expect(admitGovernedExtract(scope, {model:"anthropic/claude-sonnet-5",text:"List environments",schemaHint:"{}"})).resolves.toBeDefined();
    expect(m.reserve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({reservedCents:36}));
  } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
});

  it("never reserves or claims after cancellation while the public price request is pending", async () => {
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1"); vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", "");
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const controller = new AbortController();
    const pending = admitGovernedExtract(scope, { model: "anthropic/claude-sonnet-5", text: "List", schemaHint: "{}" }, controller.signal);
    controller.abort(); finish(new Response("{}"));
    try {
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(m.reserve).not.toHaveBeenCalled(); expect(m.claim).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  });
  it("releases only an unclaimed hold when cancellation arrives during reservation", async () => {
    let finish!: (result: unknown) => void, started!: () => void;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    m.reserve.mockImplementation(() => new Promise(resolve => { finish = resolve; started(); }));
    const controller = new AbortController();
    const pending = admitGovernedExtract(scope, undefined, controller.signal);
    await waiting; controller.abort(); finish({ ok: true, reused: false, reservation: { id: "hold" } });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(m.release).toHaveBeenCalledWith(expect.anything(), scope.organizationId, "hold"); expect(m.claim).not.toHaveBeenCalled();
  });

});
