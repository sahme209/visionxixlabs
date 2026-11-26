// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn(), epUpdate: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { webhookDelivery: { findUnique: m.findUnique, updateMany: m.updateMany, update: m.update, create: m.create }, webhookEndpoint: { update: m.epUpdate } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/governance/intelligence/enrolledRefusal", () => ({ mayDeliverTenantWebhook: async () => true }));
vi.mock("@/lib/security/webhookSignatureValidator", () => ({ signWebhookPayload: () => "ab".repeat(32) }));
import { deliverWebhookDelivery } from "../deliverWebhook";

const row = (type: string) => ({ id: "d1", status: "queued", organizationId: "org1", nextAttemptAt: null, outcomeKind: null,
  payload: { version: "v1", eventId: "evt_1", type, organizationId: "org1", attemptNumber: 1, timestampSec: 1, data: {} },
  endpoint: { id: "w1", url: "https://hooks.example.com/x", secret: "s", revokedAt: null, consecutiveFailures: 0, autoDisableThreshold: 10, organizationId: "org1" } });
beforeEach(() => { vi.clearAllMocks(); m.updateMany.mockResolvedValue({ count: 1 }); vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 }))); });
afterEach(() => vi.unstubAllGlobals());

describe("deliverWebhookDelivery with a test ping", () => {
  it("does not retry a failed ping or count it toward auto-disable", async () => {
    m.findUnique.mockResolvedValue(row("webhook.ping"));
    const r = await deliverWebhookDelivery("d1");
    expect(r?.finalDeadletter).toBe(true);
    expect(m.create).not.toHaveBeenCalled();
    expect(m.epUpdate).not.toHaveBeenCalled();
  });
  it("still retries a failed real event and counts the failure", async () => {
    m.findUnique.mockResolvedValue(row("deployment.blocked"));
    const r = await deliverWebhookDelivery("d1");
    expect(r?.finalDeadletter).toBe(false);
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.epUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { consecutiveFailures: { increment: 1 } } }));
  });
});
