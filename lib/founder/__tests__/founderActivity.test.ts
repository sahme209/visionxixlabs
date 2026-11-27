// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ members: vi.fn(), leads: vi.fn(), feedback: vi.fn(), deploys: vi.fn(), incidents: vi.fn(), audit: vi.fn(), agents: vi.fn(), webhooks: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findMany: m.members }, lead: { findMany: m.leads }, feedbackRecord: { findMany: m.feedback }, deploymentExecution: { findMany: m.deploys }, deploymentIncident: { findMany: m.incidents }, auditEvent: { findMany: m.audit }, agentGatewayRequest: { findMany: m.agents }, webhookDelivery: { findMany: m.webhooks } } }));
import { readFounderActivity } from "../founderActivity";
const NOW = new Date("2026-11-27T12:00:00Z");
const t = (iso: string) => new Date(iso);
beforeEach(() => {
  vi.clearAllMocks();
  for (const f of Object.values(m)) f.mockResolvedValue([]);
});

describe("readFounderActivity", () => {
  it("turns records into events without customer content, newest first", async () => {
    m.deploys.mockResolvedValue([{ id: "d1", createdAt: t("2026-11-27T10:00:00Z"), completedAt: t("2026-11-27T10:05:00Z"), status: "completed", conclusion: "failure", source: "agent" }]);
    m.feedback.mockResolvedValue([{ id: "f1", createdAt: t("2026-11-27T11:00:00Z"), sentiment: "negative" }]);
    m.agents.mockResolvedValue([{ id: "a1", createdAt: t("2026-11-27T09:00:00Z"), decidedAt: null, status: "pending", actionKind: "deploy_production", riskLevel: "high" }]);
    const r = await readFounderActivity(undefined, NOW);
    expect(r.events.map((e) => e.kind)).toEqual(["feedback_received", "deployment_failed", "deployment_started", "agent_request"]);
    expect(r.events.find((e) => e.kind === "deployment_failed")).toMatchObject({ signal: "deployments_failed_7d", tone: "failed" });
    expect(r.unavailable).toEqual([]);
    for (const call of [m.feedback, m.leads, m.agents, m.deploys]) {
      const select = Object.keys(call.mock.calls[0][0].select);
      expect(select).not.toContain("email"); expect(select).not.toContain("message"); expect(select).not.toContain("target"); expect(select).not.toContain("repositoryFullName");
    }
  });
  it("reads at most the last 7 days and leaves test pings out of webhook failures", async () => {
    await readFounderActivity(new Date("2026-10-01T00:00:00Z"), NOW);
    expect(m.leads.mock.calls[0][0].where.createdAt.gte).toEqual(new Date("2026-11-20T12:00:00Z"));
    expect(m.webhooks.mock.calls[0][0].where).toMatchObject({ status: "deadletter", eventKind: { not: "webhook.ping" } });
  });
  it("lists a source it cannot read instead of guessing", async () => {
    m.incidents.mockRejectedValue(new Error("db"));
    const r = await readFounderActivity(undefined, NOW);
    expect(r.unavailable).toEqual(["incidents"]);
  });
});
