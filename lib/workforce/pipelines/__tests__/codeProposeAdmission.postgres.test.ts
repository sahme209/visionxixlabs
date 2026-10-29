import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { realpathSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createGateway } from "@ai-sdk/gateway";
const f = vi.hoisted(() => ({ client: undefined as unknown as PrismaClient, model: undefined as unknown, requests: [] as Record<string, unknown>[], texts: [] as string[], failNext: false, beforeResponse: null as null | (() => Promise<void>) }));
vi.mock("@/lib/db", () => ({ get prisma() { return f.client; } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));
vi.mock("ai", async importOriginal => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: (options: Parameters<typeof actual.generateText>[0]) => actual.generateText({ ...options, model: f.model as Parameters<typeof actual.generateText>[0]["model"] }) };
});
import { codeProposeRealExecutor } from "../codeProposeRealExecutor";
import { enrollNewPublicWorkspace } from "@/lib/billing/publicFreeEnrollment";
const socket = process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
const model = "anthropic/claude-sonnet-5";
const patch = "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n";
describe.skipIf(!socket)("coding proposal → admitted manager → installed SDK → actual PostgreSQL", () => {
  beforeAll(async () => {
    if (!socket || !/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0 || (process.getuid && statSync(socket).uid !== process.getuid())) throw Error("owned_private_socket_required");
    f.client = new PrismaClient({ datasources: { db: { url: `postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}` } } });
    const [binding] = await f.client.$queryRawUnsafe<Array<{ private: boolean }>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);
    if (!binding?.private) throw Error("owned_fixture_binding_required");
    vi.stubEnv("AI_GATEWAY_MODEL", model); vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-key"); vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", "");
    // Fixed synthetic transport: never dispatches to an external provider.
    const gateway = createGateway({ apiKey: "synthetic-key", baseURL: "https://gateway.invalid/v1/ai", fetch: async (url, init) => {
      expect(String(url)).toBe("https://gateway.invalid/v1/ai/language-model");
      f.requests.push(JSON.parse(String(init?.body)));
      if (f.failNext) { f.failNext = false; throw Error("synthetic unknown provider outcome"); }
      const callback = f.beforeResponse; f.beforeResponse = null; await callback?.();
      return new Response(JSON.stringify({ content: [{ type: "text", text: f.texts.shift() ?? patch }], finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 5, noCache: 5 }, outputTokens: { total: 2, text: 2 } }, providerMetadata: { gateway: { generationId: `coding_fixture_${randomUUID()}` } }, warnings: [] }), { headers: { "content-type": "application/json" } });
    } });
    f.model = gateway(model);
  });
  beforeEach(() => { f.requests = []; f.texts = []; f.beforeResponse = null; f.failNext = false; vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", ""); });
  afterAll(async () => { await f.client?.$disconnect(); vi.unstubAllEnvs(); });
  async function fixture() {
    const organizationId = `coding_org_${randomUUID()}`, userId = `coding_user_${randomUUID()}`;
    await f.client.orgMembership.create({ data: { organizationId, userId, role: "owner", acceptedAt: new Date() } });
    // Synthetic legacy Starter fixture has its existing 2500-cent pool.
    await f.client.tenantBillingPlan.create({ data: { organizationId, tier: "starter", status: "active" } });
    await f.client.organizationAIProviderPolicy.create({ data: { organizationId, enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: model }, fallbackOrder: ["vercel_gateway"], updatedBy: userId } });
    return { organizationId, triggeredBy: userId, runId: randomUUID(), stageRunId: randomUUID(), pipelineId: randomUUID(), stageId: "propose", stageKind: "code_propose" as const, correlationId: randomUUID(), runMetadata: { instruction: "Prepare a patch", repoRef: "synthetic/repo" } };
  }
  it("records one hold and usage before returning a valid patch; same-stage replay cannot dispatch again", async () => {
    const ctx = await fixture();
    expect(await codeProposeRealExecutor(ctx)).toMatchObject({ ok: true });
    expect(f.requests).toHaveLength(1); expect(f.requests[0]).toMatchObject({ maxOutputTokens: 4096 });
    const holds = await f.client.aIUsageReservation.findMany({ where: { organizationId: ctx.organizationId } });
    expect(holds).toHaveLength(1); expect(holds[0]).toMatchObject({ reservedCents: 1000, status: "pending_settlement" }); expect(holds[0].usageEventId).toBeTruthy();
    expect(await f.client.usageEvent.count({ where: { organizationId: ctx.organizationId } })).toBe(1);
    expect(await codeProposeRealExecutor(ctx)).toMatchObject({ ok: false }); expect(f.requests).toHaveLength(1);
  });
  it("uses two separately accounted reservations for a successful refinement", async () => {
    const ctx = await fixture(); f.texts = ["synthetic malformed patch", patch];
    const result = await codeProposeRealExecutor(ctx); expect(result, JSON.stringify(result)).toMatchObject({ ok: true }); expect(f.requests).toHaveLength(2);
    const holds = await f.client.aIUsageReservation.findMany({ where: { organizationId: ctx.organizationId } });
    expect(holds).toHaveLength(2); expect(new Set(holds.map(h => h.idempotencyKey)).size).toBe(2);
    expect(holds.every(h => h.reservedCents === 1000 && h.status === "pending_settlement" && h.usageEventId)).toBe(true);
    expect(await f.client.usageEvent.count({ where: { organizationId: ctx.organizationId } })).toBe(2);
  });
  it("stops refinement when the real workspace policy is disabled after the first dispatch", async () => {
    const ctx = await fixture(); f.texts = ["synthetic malformed patch", patch];
    f.beforeResponse = async () => { await f.client.organizationAIProviderPolicy.update({ where: { organizationId: ctx.organizationId }, data: { enabled: false } }); };
    expect(await codeProposeRealExecutor(ctx)).toMatchObject({ ok: false }); expect(f.requests).toHaveLength(1);
    expect(await f.client.aIUsageReservation.count({ where: { organizationId: ctx.organizationId } })).toBe(1);
  });
  it("refuses a Free pool smaller than the generic coding reservation before SDK dispatch", async () => {
    const ctx = await fixture(); vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1"); vi.stubEnv("AXIOM_STRIPE_ACCOUNT_ID", "acct_fixture"); vi.stubEnv("AXIOM_STRIPE_MODE", "test");
    await f.client.tenantBillingPlan.delete({ where: { organizationId: ctx.organizationId } });
    expect(await f.client.$transaction(tx => enrollNewPublicWorkspace(tx, ctx.organizationId, { accountId: "acct_fixture", livemode: false }))).toBe(true);
    expect(await codeProposeRealExecutor(ctx)).toMatchObject({ ok: false }); expect(f.requests).toHaveLength(0);
    expect(await f.client.aIUsageReservation.count({ where: { organizationId: ctx.organizationId } })).toBe(0);
  });
  it("refuses legacy machine labels without charging a workspace owner", async () => {
    const ctx = await fixture(); ctx.triggeredBy = "api_key:synthetic";
    expect(await codeProposeRealExecutor(ctx)).toMatchObject({ ok: false }); expect(f.requests).toHaveLength(0);
    expect(await f.client.aIUsageReservation.count({ where: { organizationId: ctx.organizationId } })).toBe(0);
  });
  it("retains an uncertain dispatch hold and refuses replay after a transport failure", async () => {
    const ctx = await fixture(); f.failNext = true;
    expect(await codeProposeRealExecutor(ctx)).toMatchObject({ ok: false }); expect(f.requests).toHaveLength(1);
    const holds = await f.client.aIUsageReservation.findMany({ where: { organizationId: ctx.organizationId } });
    expect(holds).toHaveLength(1); expect(holds[0]).toMatchObject({ status: "dispatch_unknown", reservedCents: 1000, usageEventId: null });
    expect(await codeProposeRealExecutor(ctx)).toMatchObject({ ok: false }); expect(f.requests).toHaveLength(1);
    expect(await f.client.usageEvent.count({ where: { organizationId: ctx.organizationId } })).toBe(0);
  });
  it("fails a still malformed refinement while keeping both completed attempts accounted", async () => {
    const ctx = await fixture(); f.texts = ["synthetic malformed first", "synthetic malformed refinement"];
    expect(await codeProposeRealExecutor(ctx)).toMatchObject({ ok: false }); expect(f.requests).toHaveLength(2);
    const holds = await f.client.aIUsageReservation.findMany({ where: { organizationId: ctx.organizationId } });
    expect(holds).toHaveLength(2); expect(holds.every(h => h.status === "pending_settlement" && h.usageEventId)).toBe(true);
  });
  it("refuses refinement when the selected model changes after initial generation", async () => {
    const ctx = await fixture(); f.texts = ["synthetic malformed patch", patch];
    f.beforeResponse = async () => { await f.client.organizationAIProviderPolicy.update({ where: { organizationId: ctx.organizationId }, data: { modelSelections: { vercel_gateway: "xai/grok-4.20-multi-agent" } } }); };
    expect(await codeProposeRealExecutor(ctx)).toMatchObject({ ok: false }); expect(f.requests).toHaveLength(1);
    expect(await f.client.aIUsageReservation.count({ where: { organizationId: ctx.organizationId } })).toBe(1);
  });

});
