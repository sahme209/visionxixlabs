import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { realpathSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createGateway } from "@ai-sdk/gateway";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ client: undefined as unknown as PrismaClient, model: undefined as unknown, phase: 0, respondImmediately: false, requests: [] as Record<string, unknown>[], session: null as null | { id: string; organizationId: string; userId: string; credentialKind: string }, beforeResponse: null as null | (() => void) }));
vi.mock("@/lib/db", () => ({ get prisma() { return f.client; } }));
// Authentication is deliberately synthetic. All downstream policy, credits,
// tool execution, SDK protocol and persistence use the real application code.
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: async () => f.session }));
vi.mock("ai", async importOriginal => {
 const actual = await importOriginal<typeof import("ai")>();
 return { ...actual,
  generateText: (options: Parameters<typeof actual.generateText>[0]) => actual.generateText({ ...options, model: f.model as Parameters<typeof actual.generateText>[0]["model"] }),
  streamText: (options: Parameters<typeof actual.streamText>[0]) => actual.streamText({ ...options, model: f.model as Parameters<typeof actual.streamText>[0]["model"] }),
 };
});
import { POST } from "@/app/api/desktop/agent/conversations/[id]/messages/route";
import { enrollNewPublicWorkspace } from "@/lib/billing/publicFreeEnrollment";
import { smallSonnetPricingFixture } from "@/lib/billing/__tests__/fixtures/smallSonnetPricing";
import { AGENT_STREAM_CONTENT_TYPE, AGENT_TOOL_ACTIVITY_FEATURE } from "@/lib/desktop/agentMessageStreamProtocol";
const socket = process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
const model = "anthropic/claude-sonnet-5";
describe.skipIf(!socket)("desktop HTTP request → actual Agent/database/tool/SDK chain", () => {
 beforeAll(async () => {
  if (!socket || !/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0 || (process.getuid && statSync(socket).uid !== process.getuid())) throw Error("owned_private_socket_required");
  f.client = new PrismaClient({ datasources: { db: { url: `postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}` } } });
  const [binding] = await f.client.$queryRawUnsafe<Array<{ private: boolean }>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);
  if (!binding?.private) throw Error("owned_fixture_binding_required");
  vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", "axiom_public_anniversary_v1"); vi.stubEnv("AXIOM_STRIPE_ACCOUNT_ID", "acct_fixture"); vi.stubEnv("AXIOM_STRIPE_MODE", "test");
  vi.stubEnv("AI_GATEWAY_MODEL", model); vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-key"); vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS", "");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
   if (url === "https://ai-gateway.vercel.sh/v1/models") return new Response(JSON.stringify({ data: [{ id: model, name: "Synthetic Sonnet 5", type: "language" }] }));
   if (url === `https://ai-gateway.vercel.sh/v1/models/${model}/endpoints`) return new Response(JSON.stringify(smallSonnetPricingFixture()));
   throw Error("unexpected_external_fixture_request");
  }));
  const gateway = createGateway({ apiKey: "synthetic-key", baseURL: "https://gateway.invalid/v1/ai", fetch: async (url, init) => {
   expect(String(url)).toBe("https://gateway.invalid/v1/ai/language-model"); const body = JSON.parse(String(init?.body)); f.requests.push(body);
   const callback = f.beforeResponse; f.beforeResponse = null; callback?.();
   const text = JSON.stringify(f.respondImmediately ? { action: "respond", message: "Synthetic immediate response." } : ++f.phase % 2 ? { action: "call_tool", message: "Inspect configured environments", toolName: "list_environments", args: {} } : { action: "respond", message: "No environments are configured in this synthetic workspace." });
   const usage = { inputTokens: { total: 5, noCache: 5 }, outputTokens: { total: 2, text: 2 } }, providerMetadata = { gateway: { generationId: `http_fixture_${randomUUID()}` } };
   if (new Headers(init?.headers).get("ai-language-model-streaming") === "true") {
    const parts = [{ type: "stream-start", warnings: [] }, { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: text }, { type: "text-end", id: "t" }, { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage, providerMetadata }];
    return new Response(parts.map(part => `data: ${JSON.stringify(part)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
   }
   return new Response(JSON.stringify({ content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage, providerMetadata, warnings: [] }), { headers: { "content-type": "application/json" } });
  } }); f.model = gateway(model);
 });
 beforeEach(() => { f.phase = 0; f.respondImmediately = false; f.requests = []; f.beforeResponse = null; f.session = null; });
 afterAll(async () => { await f.client?.$disconnect(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
 async function fixture() {
  const organizationId = `http_org_${randomUUID()}`, userId = `http_user_${randomUUID()}`;
  await f.client.orgMembership.create({ data: { organizationId, userId, role: "owner", acceptedAt: new Date() } });
  await f.client.organizationAIProviderPolicy.create({ data: { organizationId, enabled: true, allowedProviders: ["vercel_gateway"], modelSelections: { vercel_gateway: model }, fallbackOrder: ["vercel_gateway"], updatedBy: userId } });
  await f.client.workspaceAgentIdentity.create({ data: { organizationId, enabled: true, allowedTools: ["list_environments"], updatedBy: userId } });
  expect(await f.client.$transaction(tx => enrollNewPublicWorkspace(tx, organizationId, { accountId: "acct_fixture", livemode: false }))).toBe(true);
  const conversation = await f.client.agentConversation.create({ data: { organizationId, userId } });
  f.session = { id: `synthetic_session_${randomUUID()}`, organizationId, userId, credentialKind: "desktop_session" };
  return { organizationId, userId, conversationId: conversation.id };
 }
 async function request(conversationId: string, stream = false, selectedRepository = false, signal?: AbortSignal) {
  return POST(new NextRequest(`https://axiom.invalid/api/desktop/agent/conversations/${conversationId}/messages`, { method: "POST", signal, headers: { "content-type": "application/json", ...(stream ? { accept: AGENT_STREAM_CONTENT_TYPE } : {}) }, body: JSON.stringify({ message: "List configured environments only. Do not inspect repositories or propose changes.", preferredProvider: "vercel_gateway", preferredModel: model, streamFeatures: [AGENT_TOOL_ACTIVITY_FEATURE], workspaceContext: { operationMode: "inspect", ...(selectedRepository ? { repositoryFullName: "synthetic/unrelated", branch: "main" } : {}) } }) }), { params: Promise.resolve({ id: conversationId }) });
 }
 it.each([false, true])("persists the real read-only tool and assistant reply with two linked credit holds (stream=%s)", async stream => {
  const ctx = await fixture(), response = await request(ctx.conversationId, stream);
  expect(response.status).toBe(200);
  let data: Record<string, unknown>;
  if (stream) {
   expect(response.headers.get("content-type")).toContain(AGENT_STREAM_CONTENT_TYPE);
   const frames = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
   expect(frames.some(frame => frame.type === "tool_activity" && frame.activity.toolName === "list_environments" && frame.activity.state === "completed"), JSON.stringify(frames)).toBe(true);
   data = frames.find(frame => frame.type === "result")?.data;
  } else data = (await response.json()).data;
  expect(data, JSON.stringify(data)).toMatchObject({ reply: "No environments are configured in this synthetic workspace.", proposal: null });
  expect(f.requests).toHaveLength(2); expect(f.requests.every(r => r.maxOutputTokens === 4096)).toBe(true);
  const turns = await f.client.agentConversationTurn.findMany({ where: { conversationId: ctx.conversationId } });
  expect(turns.map(t => t.role).sort()).toEqual(["assistant", "user"]);
  const actions = await f.client.agentActionProposal.findMany({ where: { conversationId: ctx.conversationId } });
  expect(actions).toHaveLength(1); expect(actions[0]).toMatchObject({ organizationId: ctx.organizationId, proposedByUserId: ctx.userId, toolName: "list_environments", status: "executed", resultJson: [] });
  const holds = await f.client.aIUsageReservation.findMany({ where: { organizationId: ctx.organizationId } });
  expect(holds).toHaveLength(2); expect(holds.every(h => h.reservedCents === 100 && h.status === "pending_settlement" && h.usageEventId)).toBe(true);
 });
 it("does not auto-read an unrelated selected repository before the environment request", async () => {
  const ctx = await fixture(), response = await request(ctx.conversationId, false, true);
  const data = (await response.json()).data; expect(data, JSON.stringify(data)).toMatchObject({ proposal: null }); expect(f.requests, JSON.stringify(data)).toHaveLength(2);
  const actions = await f.client.agentActionProposal.findMany({ where: { conversationId: ctx.conversationId } });
  expect(actions.map(a => a.toolName)).toEqual(["list_environments"]);
 });
 it.each(["workspace", "user"] as const)("refuses a foreign %s conversation before persistence, reservation or inference", async boundary => {
  const ctx = await fixture(); f.session = { ...f.session!, ...(boundary === "workspace" ? { organizationId: "foreign_synthetic_org" } : { userId: "foreign_synthetic_user" }) };
  expect((await request(ctx.conversationId)).status).toBe(404); expect(f.requests).toHaveLength(0);
  expect(await f.client.agentConversationTurn.count({ where: { conversationId: ctx.conversationId } })).toBe(0);
  expect(await f.client.aIUsageReservation.count({ where: { organizationId: ctx.organizationId } })).toBe(0);
 });
 it("reports a disabled real workspace Agent without a provider dispatch", async () => {
  const ctx = await fixture(); await f.client.workspaceAgentIdentity.update({ where: { organizationId: ctx.organizationId }, data: { enabled: false } });
  const response = await request(ctx.conversationId); expect((await response.json()).data).toMatchObject({ proposal: null, issue: "workspace_agent_disabled" });
  expect(f.requests).toHaveLength(0); expect(await f.client.aIUsageReservation.count({ where: { organizationId: ctx.organizationId } })).toBe(0);
 });
 it("stops a cancelled stream without a second dispatch or an invented assistant completion", async () => {
  const ctx = await fixture(), cancellation = new AbortController(); f.beforeResponse = () => cancellation.abort();
  const response = await request(ctx.conversationId, true, false, cancellation.signal); const text = await response.text();
  expect(text).not.toContain('"type":"result"'); expect(f.requests).toHaveLength(1);
  expect(await f.client.agentConversationTurn.count({ where: { conversationId: ctx.conversationId, role: "assistant" } })).toBe(0);
  const holds = await f.client.aIUsageReservation.findMany({ where: { organizationId: ctx.organizationId } });
  expect(holds).toHaveLength(1); expect(["dispatch_unknown", "pending_settlement"]).toContain(holds[0].status);
 });
 it("keeps distinct requests independent even when their start timestamp is identical", async () => {
  const ctx = await fixture(); f.respondImmediately = true;
  const second = await f.client.agentConversation.create({ data: { organizationId: ctx.organizationId, userId: ctx.userId } });
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now());
  try {
   for (const id of [ctx.conversationId, second.id]) {
    const response = await request(id), data = (await response.json()).data;
    expect(data, JSON.stringify(data)).toMatchObject({ reply: "Synthetic immediate response.", proposal: null });
   }
  } finally { clock.mockRestore(); }
  expect(f.requests).toHaveLength(2);
  const usage = await f.client.usageEvent.findMany({ where: { organizationId: ctx.organizationId } });
  expect(usage).toHaveLength(2); expect(new Set(usage.map(row => row.correlationId)).size).toBe(2);
 });

 it("refuses an unauthenticated HTTP request before accessing conversation data or credits", async () => {
  const ctx = await fixture(); f.session = null;
  expect((await request(ctx.conversationId)).status).toBe(401); expect(f.requests).toHaveLength(0);
  expect(await f.client.agentConversationTurn.count({ where: { conversationId: ctx.conversationId } })).toBe(0);
  expect(await f.client.aIUsageReservation.count({ where: { organizationId: ctx.organizationId } })).toBe(0);
 });

});
