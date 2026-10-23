import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { realpathSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createGateway } from "@ai-sdk/gateway";
const f = vi.hoisted(() => ({ client: undefined as unknown as PrismaClient, model: undefined as unknown,
  phase: 0, malformedNext: false, beforeResponse: null as null | (() => Promise<void>), requests: [] as Array<{ headers: Headers; body: Record<string, unknown> }> }));
vi.mock("@/lib/db", () => ({ get prisma() { return f.client; } }));
vi.mock("@/lib/ai/gatewayModelCatalog", async original => ({ ...await original<typeof import("@/lib/ai/gatewayModelCatalog")>(),
  loadGatewayModelCatalog: vi.fn(async () => [{ id: "anthropic/claude-sonnet-5" }]) }));
vi.mock("ai", async original => {
  const actual = await original<typeof import("ai")>();
  return { ...actual,
    generateText: (options: Parameters<typeof actual.generateText>[0]) => actual.generateText({ ...options, model: f.model as Parameters<typeof actual.generateText>[0]["model"] }),
    streamText: (options: Parameters<typeof actual.streamText>[0]) => actual.streamText({ ...options, model: f.model as Parameters<typeof actual.streamText>[0]["model"] }),
  };
});
import { runDecisionLoop } from "../decisionLoop";
import { enrollNewPublicWorkspace } from "@/lib/billing/publicFreeEnrollment";
import { readCurrentAIAllowance } from "@/lib/billing/currentAIAllowance";
import { reconcilePendingGatewayUsage, type GatewayUsageRepository } from "@/lib/billing/reconcileGatewayUsage";
import { smallSonnetPricingFixture } from "@/lib/billing/__tests__/fixtures/smallSonnetPricing";

const socket = process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
const model = "anthropic/claude-sonnet-5";
describe.skipIf(!socket)("Agent decision → installed SDK → actual PostgreSQL credits → settlement", () => {
  beforeAll(async () => {
    if (!socket || !/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket)
        || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0
        || (process.getuid && statSync(socket).uid !== process.getuid())) throw new Error("owned_private_socket_required");
    f.client = new PrismaClient({ datasources: { db: {
      url: `postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`,
    } } });
    const [binding] = await f.client.$queryRawUnsafe<Array<{ private: boolean }>>(
      `SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture'
       AND current_setting('listen_addresses')='' AS private`);
    if (!binding?.private) throw new Error("owned_fixture_binding_required");
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1");
    vi.stubEnv("AXIOM_STRIPE_ACCOUNT_ID", "acct_fixture"); vi.stubEnv("AXIOM_STRIPE_MODE", "test");
    vi.stubEnv("AI_GATEWAY_MODEL", model); vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-key"); vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", "");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(smallSonnetPricingFixture()))));
    const gateway = createGateway({ apiKey: "synthetic-key", baseURL: "https://gateway.invalid/v1/ai", fetch: async (url, init) => {
      // This installed SDK transport has no network branch and no real key.
      expect(String(url)).toBe("https://gateway.invalid/v1/ai/language-model");
      const headers = new Headers(init?.headers), body = JSON.parse(String(init?.body));
      f.requests.push({ headers, body });
      const step = f.requests.length;
      await f.beforeResponse?.(); f.beforeResponse = null;
      const malformed = f.malformedNext; f.malformedNext = false;
      const text = malformed ? "synthetic malformed response" : JSON.stringify(++f.phase % 2 ? { action: "call_tool", message: "Inspect environments", toolName: "list_environments", args: {} }
        : { action: "respond", message: "No environments configured in this synthetic workspace" });
      const usage = { inputTokens: { total: 5, noCache: 5 }, outputTokens: { total: 2, text: 2 } };
      const providerMetadata = { gateway: { generationId: `fixture_generation_${step}` } };
      if (headers.get("ai-language-model-streaming") === "true") {
        const parts = [{ type: "stream-start", warnings: [] }, { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: text }, { type: "text-end", id: "t" },
          { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage, providerMetadata }];
        return new Response(parts.map(part => `data: ${JSON.stringify(part)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
      }
      return new Response(JSON.stringify({ content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage, providerMetadata, warnings: [] }), { headers: { "content-type": "application/json" } });
    } });
    f.model = gateway(model);
  });
  afterAll(async () => { await f.client?.$disconnect(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it.each([false, true])("accounts both bounded steps and releases unused credit after exact receipt settlement (stream=%s)", async streaming => {
    f.phase = 0;
    const organizationId = `fixture_org_${randomUUID()}`, userId = `fixture_user_${randomUUID()}`;
    await f.client.orgMembership.create({ data: { organizationId, userId, role: "owner", acceptedAt: new Date() } });
    await f.client.organizationAIProviderPolicy.create({ data: { organizationId, enabled: true, allowedProviders: ["vercel_gateway"],
      modelSelections: { vercel_gateway: model }, fallbackOrder: ["vercel_gateway"], updatedBy: userId } });
    await f.client.workspaceAgentIdentity.create({ data: { organizationId, enabled: true, allowedTools: ["list_environments"], updatedBy: userId } });
    expect(await f.client.$transaction(tx => enrollNewPublicWorkspace(tx, organizationId, { accountId: "acct_fixture", livemode: false }))).toBe(true);
    const starting = f.requests.length;
    const tool = vi.fn(async () => ({ ok: true as const, result: { environments: [] } }));
    const run = (correlationId: string) => runDecisionLoop({ organizationId, userId, correlationId,
      transcript: [{ role: "user", content: "List configured environments" }], operationMode: "inspect",
      preferredProvider: "vercel_gateway", preferredModel: model,
      ...(streaming ? { streaming: { abortSignal: new AbortController().signal, onDraft: vi.fn() } } : {}),
      executeReadOnlyTool: tool, isProdEnvironmentTarget: async () => false });
    const result = await run(`fixture_${randomUUID()}`);
    expect(result, JSON.stringify(result)).toMatchObject({ kind: "final", usage: { decisionSteps: 2 } });
    expect(tool).toHaveBeenCalledOnce(); expect(f.requests).toHaveLength(starting + 2);
    for (const sent of f.requests.slice(starting)) {
      expect(sent.headers.get("ai-language-model-id")).toBe(model);
      expect(sent.body).toMatchObject({ maxOutputTokens: 4096, providerOptions: { gateway: { only: ["anthropic"] }, anthropic: { thinking: { type: "disabled" } } } });
      expect(sent.body.tools).toBeUndefined();
    }
    const holds = await f.client.aIUsageReservation.findMany({ where: { organizationId } });
    expect(holds).toHaveLength(2); expect(holds.every(h => h.status === "pending_settlement" && h.reservedCents === 100 && h.usageEventId)).toBe(true);
    expect(await readCurrentAIAllowance(f.client, organizationId)).toMatchObject({ available: true, poolCents: 200, heldCents: 200, usedCents: 0, includedRemainingCents: 0 });
    expect(await run(`fixture_${randomUUID()}`)).toMatchObject({ kind: "error", error: "workspace_ai_credit_pool_exhausted" });
    expect(f.requests).toHaveLength(starting + 2);
    const lookup = vi.fn(async (id: string) => ({ id, totalCost: 0.001, model, providerName: "anthropic", promptTokens: 5, completionTokens: 2, cachedTokens: 0 }));
    expect(await reconcilePendingGatewayUsage(f.client as unknown as GatewayUsageRepository, lookup)).toMatchObject({ inspected: 2, settled: 2, failed: 0 });
    expect(await readCurrentAIAllowance(f.client, organizationId)).toMatchObject({ available: true, poolCents: 200, heldCents: 0, usedCents: 4, includedRemainingCents: 196 });
    expect(await reconcilePendingGatewayUsage(f.client as unknown as GatewayUsageRepository, lookup)).toMatchObject({ inspected: 0, settled: 0 });
    expect(lookup).toHaveBeenCalledTimes(2);
  });
  it.each([false, true].flatMap(streaming => ["disabled", "removed"].map(change => ({ streaming, change }))))("stops before another paid step after actual identity $change (stream=$streaming)", async ({ streaming, change }) => {
    f.phase = 0;
    const organizationId = `revoked_org_${randomUUID()}`, userId = `revoked_user_${randomUUID()}`;
    await f.client.orgMembership.create({ data: { organizationId, userId, role: "owner", acceptedAt: new Date() } });
    await f.client.organizationAIProviderPolicy.create({ data: { organizationId, enabled: true, allowedProviders: ["vercel_gateway"],
      modelSelections: { vercel_gateway: model }, fallbackOrder: ["vercel_gateway"], updatedBy: userId } });
    await f.client.workspaceAgentIdentity.create({ data: { organizationId, enabled: true, allowedTools: ["list_environments"], updatedBy: userId } });
    await f.client.$transaction(tx => enrollNewPublicWorkspace(tx, organizationId, { accountId: "acct_fixture", livemode: false }));
    const starting = f.requests.length;
    const tool = vi.fn(async () => {
      await f.client.workspaceAgentIdentity.update({ where: { organizationId }, data: { enabled: change !== "disabled", allowedTools: [] } });
      return { ok: true as const, result: { environments: [] } };
    });
    const result = await runDecisionLoop({ organizationId, userId, correlationId: `revoked_${randomUUID()}`,
      transcript: [{ role: "user", content: "List configured environments" }], operationMode: "inspect",
      preferredProvider: "vercel_gateway", preferredModel: model,
      ...(streaming ? { streaming: { abortSignal: new AbortController().signal, onDraft: vi.fn() } } : {}),
      executeReadOnlyTool: tool, isProdEnvironmentTarget: async () => false });
    expect(result).toMatchObject({ kind: "error", error: change === "disabled" ? "workspace_agent_disabled" : "agent_tool_not_allowed", usage: { decisionSteps: 1 } });
    expect(tool).toHaveBeenCalledOnce(); expect(f.requests).toHaveLength(starting + 1);
    expect(await f.client.aIUsageReservation.findMany({ where: { organizationId } }))
      .toMatchObject([{ status: "pending_settlement", reservedCents: 100 }]);
  });

  it.each([false, true])("does not buy a JSON repair after identity revocation during the accounted response (stream=%s)", async streaming => {
    f.phase = 0;
    const organizationId = `repair_org_${randomUUID()}`, userId = `repair_user_${randomUUID()}`;
    await f.client.orgMembership.create({ data: { organizationId, userId, role: "owner", acceptedAt: new Date() } });
    await f.client.organizationAIProviderPolicy.create({ data: { organizationId, enabled: true, allowedProviders: ["vercel_gateway"],
      modelSelections: { vercel_gateway: model }, fallbackOrder: ["vercel_gateway"], updatedBy: userId } });
    await f.client.workspaceAgentIdentity.create({ data: { organizationId, enabled: true, allowedTools: ["list_environments"], updatedBy: userId } });
    await f.client.$transaction(tx => enrollNewPublicWorkspace(tx, organizationId, { accountId: "acct_fixture", livemode: false }));
    const starting = f.requests.length;
    f.malformedNext = true;
    f.beforeResponse = async () => { await f.client.workspaceAgentIdentity.update({ where: { organizationId }, data: { enabled: false, allowedTools: [] } }); };
    const tool = vi.fn();
    const result = await runDecisionLoop({ organizationId, userId, correlationId: `repair_${randomUUID()}`,
      transcript: [{ role: "user", content: "List configured environments" }], operationMode: "inspect",
      preferredProvider: "vercel_gateway", preferredModel: model,
      ...(streaming ? { streaming: { abortSignal: new AbortController().signal, onDraft: vi.fn() } } : {}),
      executeReadOnlyTool: tool, isProdEnvironmentTarget: async () => false });
    expect(result).toMatchObject({ kind: "error", error: "workspace_agent_disabled", usage: { decisionSteps: 1 } });
    expect(tool).not.toHaveBeenCalled(); expect(f.requests).toHaveLength(starting + 1);
    expect(await f.client.aIUsageReservation.findMany({ where: { organizationId } }))
      .toMatchObject([{ status: "pending_settlement", reservedCents: 100 }]);
  });

});
