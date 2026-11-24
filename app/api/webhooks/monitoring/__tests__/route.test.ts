import {createHmac, randomBytes} from "node:crypto";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {POST} from "../route";

const mocks = vi.hoisted(() => ({
  table: {findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn()},
  receipts: {createMany: vi.fn(), count: vi.fn()},
  transaction: vi.fn(),
  credit: vi.fn(),
  analyze: vi.fn(),
  persistAnalysis: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({prisma: {aiRationaleEnrichment: mocks.table, $transaction: mocks.transaction}}));
vi.mock("@/lib/billing/checkWorkspaceAICredits", () => ({checkWorkspaceAICredits: mocks.credit}));
vi.mock("@/lib/audit/secureAudit", () => ({record: mocks.audit}));
vi.mock("@/lib/workforce/domains/workloadPerformanceEngineer", () => ({
  runWorkloadPerformanceEngineer: mocks.analyze,
  persistWorkloadPerformanceAnalysis: mocks.persistAnalysis,
}));

const secret = randomBytes(32).toString("hex");
const tags = [
  "webhook_secret|" + secret, "provider|generic", "enabled|true",
  "auto_analyze|true", "daily_cost_cap_cents|30",
];
const workspace = {organizationId: "fixture-workspace", targetId: "fixture-workspace", nextActionsJson: tags};

function deliver(payload: unknown = {id: "incident-1", title: "Example incident", severity: "high", state: "firing"}) {
  const body = JSON.stringify(payload);
  return POST(new Request("https://local-test.invalid/api/webhooks/monitoring", {
    method: "POST", body, headers: {"x-webhook-signature": createHmac("sha256", secret).update(body).digest("hex")},
  }));
}

describe("monitoring webhook delivery admission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.table.findMany.mockResolvedValue([workspace]);
    mocks.table.findUnique.mockResolvedValue({nextActionsJson: tags});
    mocks.receipts.createMany.mockResolvedValue({count: 1});
    mocks.table.upsert.mockResolvedValue({});
    mocks.receipts.count.mockResolvedValue(0);
    mocks.transaction.mockImplementation(callback => callback({aiRationaleEnrichment: mocks.table, idempotencyRecord: mocks.receipts}));
    mocks.credit.mockResolvedValue({kind: "allow"});
    mocks.analyze.mockResolvedValue({slug: "fixture-analysis"});
  });

  it("records the delivery before reserving estimated analysis cost for the matched workspace", async () => {
    expect(await (await deliver()).json()).toMatchObject({ok: true, analysisSlug: "fixture-analysis"});
    expect(mocks.table.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({organizationId: workspace.organizationId, outcome: "fallback_rules"}),
    }));
    const [delivery, admission] = mocks.receipts.createMany.mock.calls.map(call => call[0]);
    expect(delivery.data.routePath).toBe("/api/webhooks/monitoring");
    expect(admission).toMatchObject({
      skipDuplicates: true, data: {organizationId: workspace.organizationId, idempotencyKey: delivery.data.idempotencyKey, routePath: "/api/webhooks/monitoring#analysis"},
    });
    expect(mocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), {isolationLevel: "Serializable"});
    expect(mocks.analyze).toHaveBeenCalledOnce();
  });

  it("acknowledges an already recorded delivery without replacing evidence or charging for analysis", async () => {
    mocks.receipts.createMany.mockResolvedValueOnce({count: 0});
    expect(await (await deliver()).json()).toMatchObject({ok: true, duplicate: true, analysisSkipReason: "delivery_already_recorded"});
    expect(mocks.table.upsert).not.toHaveBeenCalled();
    expect(mocks.credit).not.toHaveBeenCalled();
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it("does not start analysis when alert storage fails", async () => {
    mocks.table.upsert.mockRejectedValueOnce(new Error("fixture storage failure"));
    expect((await deliver()).status).toBe(503);
    expect(mocks.credit).not.toHaveBeenCalled();
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it("refuses ambiguous or noncanonical workspace registrations", async () => {
    mocks.table.findMany.mockResolvedValueOnce([
      workspace, {...workspace, organizationId: "second", targetId: "second"},
    ]).mockResolvedValueOnce([{...workspace, targetId: "unrelated-row"}]);
    expect((await deliver()).status).toBe(401);
    expect((await deliver()).status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("persists the delivery but skips inference when the configuration changed", async () => {
    mocks.table.findUnique.mockResolvedValueOnce({nextActionsJson: tags.map(tag => tag === "enabled|true" ? "enabled|false" : tag)});
    expect(await (await deliver()).json()).toMatchObject({ok: true, analysisSkipReason: "monitoring_config_changed"});
    expect(mocks.table.upsert).toHaveBeenCalledOnce();
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it("honors the remaining allowance and refuses analysis when its count is unavailable", async () => {
    mocks.receipts.count.mockResolvedValueOnce(1).mockRejectedValueOnce(new Error("fixture meter failure"));
    expect(await (await deliver()).json()).toMatchObject({ok: true, analysisSkipReason: "daily_cost_cap_reached"});
    expect(await (await deliver()).json()).toMatchObject({ok: true, analysisSkipReason: "daily_cost_meter_unavailable"});
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
});

describe("monitoring provider event ordering", () => {
  const providerTags = tags.map(tag => tag === "provider|generic" ? "provider|grafana" : tag);
  const startedAt = "2026-11-22T10:00:00Z";
  const fingerprint = "f404ecabc8dd5cd7";
  const body = (status: string, start = startedAt, endsAt?: string) => ({
    alerts: [{fingerprint, status, startsAt: start, endsAt, labels: {alertname: "Example", severity: "high"}}],
  });

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.table.findMany.mockResolvedValue([{...workspace, nextActionsJson: providerTags}]);
    mocks.table.findUnique.mockResolvedValue(null);
    mocks.receipts.createMany.mockResolvedValue({count: 1});
    mocks.receipts.count.mockResolvedValue(0);
    mocks.table.upsert.mockResolvedValue({});
    mocks.transaction.mockImplementation(callback => callback({aiRationaleEnrichment: mocks.table, idempotencyRecord: mocks.receipts}));
    mocks.credit.mockResolvedValue({kind: "allow"});
  });

  it("keeps a resolved episode and skips analysis on a delayed firing notification", async () => {
    mocks.table.findUnique.mockResolvedValueOnce({nextActionsJson: [
      "source_started_at|2026-11-22T10:00:00.000Z", "source_resolved_at|2026-11-22T10:30:00.000Z",
    ]});
    expect(await (await deliver(body("firing"))).json()).toMatchObject({
      alertSlug: "grafana_fingerprint_" + fingerprint, analysisSkipReason: "source_event_already_observed_or_superseded",
    });
    expect(mocks.table.upsert).not.toHaveBeenCalled();
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it("advances a firing episode to resolved under serializable storage", async () => {
    mocks.table.findUnique.mockResolvedValueOnce({nextActionsJson: ["source_started_at|2026-11-22T10:00:00.000Z"]});
    expect(await (await deliver(body("resolved", startedAt, "2026-11-22T10:30:00Z"))).json()).toMatchObject({analysisSkipReason: "alert_not_firing"});
    expect(mocks.table.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({nextActionsJson: expect.arrayContaining(["source_resolved_at|2026-11-22T10:30:00.000Z"])}),
    }));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {isolationLevel: "Serializable"});
  });

  it("retains unsequenced source evidence separately without starting analysis", async () => {
    expect(await (await deliver(body("firing", "not-a-date"))).json()).toMatchObject({
      alertSlug: expect.stringMatching(/^grafana_unsequenced_/), analysisSkipReason: "source_event_order_unavailable",
    });
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it("checks the ordered event is still current before reserving analysis", async () => {
    mocks.table.findUnique.mockResolvedValueOnce(null)
      .mockResolvedValueOnce({nextActionsJson: providerTags})
      .mockResolvedValueOnce({nextActionsJson: ["source_body_sha256|newer"]});
    expect(await (await deliver(body("firing"))).json()).toMatchObject({analysisSkipReason: "source_event_already_observed_or_superseded"});
    expect(mocks.receipts.createMany).toHaveBeenCalledOnce();
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("accepts native timestamped Grafana signatures only for a Grafana registration", async () => {
    const payload = JSON.stringify(body("resolved", startedAt, "2026-11-22T10:30:00Z"));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = {
      "x-grafana-alerting-signature": createHmac("sha256", secret).update(timestamp + ":" + payload).digest("hex"),
      "x-grafana-alerting-timestamp": timestamp,
    };
    const post = () => POST(new Request("https://local-test.invalid/api/webhooks/monitoring", {method: "POST", body: payload, headers}));
    expect(await (await post()).json()).toMatchObject({ok: true, analysisSkipReason: "alert_not_firing"});
    mocks.table.findMany.mockResolvedValueOnce([workspace]);
    expect((await post()).status).toBe(401);
    expect(mocks.table.upsert).toHaveBeenCalledOnce();
  });

});
