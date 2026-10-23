import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ currentRule: vi.fn(), currentConnection: vi.fn(), trigger: vi.fn(), update: vi.fn(), advance: vi.fn(), runs: vi.fn(), invalidVersion: false }));
const updatedAt = new Date("2026-10-15T09:00:00Z");
const scheduledAt = new Date("2026-10-15T10:00:00Z");
const connectionVersion = new Date("2026-10-15T08:00:00Z");
vi.mock("@/lib/db", () => ({ prisma: {
  airflowAutomation: { groupBy: async () => [{ organizationId: "org" }], findMany: async () => [{ id: "rule", organizationId: "org", connectionId: "connection", enabled: true, dagId: "dag", triggerMode: "schedule", scheduleCron: "0 * * * *", nextScheduledAt: scheduledAt, createdAt: new Date(0), updatedAt: f.invalidVersion ? undefined : updatedAt }], findFirst: f.currentRule, update: f.update, updateMany: f.advance },
  tenantIntegrationConnection: { findFirst: f.currentConnection },
  airflowAutomationExecution: { findMany: async () => [] },
  airflowDagRunSnapshot: { upsert: vi.fn() },
} }));
vi.mock("../connection", () => ({ loadAirflowClient: async () => ({ connectionId: "connection", connectionUpdatedAt: connectionVersion, client: { triggerDag: f.trigger, listDagRuns: f.runs } }) }));
vi.mock("../automationExecutor", () => ({ executeAirflowAutomation: vi.fn() }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn() }));
import { runAirflowAutomationTick } from "../automationTick";
beforeEach(() => {
  vi.resetAllMocks(); f.invalidVersion = false; f.advance.mockResolvedValue({ count: 1 }); f.currentRule.mockResolvedValue({ id: "rule" }); f.currentConnection.mockResolvedValue({ id: "connection" }); f.runs.mockResolvedValue([]);
  f.trigger.mockResolvedValue({ dagId: "dag", dagRunId: "fixture", state: "queued", logicalDate: null, startedAt: null, endedAt: null });
});
it.each(["paused_or_changed_rule", "revoked_or_reconnected", "rule_read_failed", "connection_read_failed"])("refuses a stale scheduled dispatch: %s", async state => {
  if (state === "paused_or_changed_rule") f.currentRule.mockResolvedValue(null);
  if (state === "revoked_or_reconnected") f.currentConnection.mockResolvedValue(null);
  if (state === "rule_read_failed") f.currentRule.mockRejectedValue(Error("private database diagnostic"));
  if (state === "connection_read_failed") f.currentConnection.mockRejectedValue(Error("private database diagnostic"));
  expect(await runAirflowAutomationTick(new Date("2026-10-15T10:01:00Z"))).toMatchObject({ errors: 1, actions: 0, proposals: 0 });
  expect(f.trigger).not.toHaveBeenCalled(); expect(f.update).not.toHaveBeenCalled();
});
it("rechecks the exact enabled rule and active credential version before a deterministic scheduled trigger", async () => {
  expect(await runAirflowAutomationTick(new Date("2026-10-15T10:01:00Z"))).toMatchObject({ errors: 0 });
  expect(f.currentRule).toHaveBeenCalledWith({ where: { id: "rule", organizationId: "org", enabled: true, connectionId: "connection", updatedAt, nextScheduledAt: scheduledAt }, select: { id: true } });
  expect(f.currentConnection).toHaveBeenCalledWith({ where: { id: "connection", organizationId: "org", provider: "airflow", status: "active", updatedAt: connectionVersion }, select: { id: true } });
  expect(f.trigger).toHaveBeenCalledOnce();
});
it("refuses a missing version rather than omitting an undefined authority predicate", async () => {
  f.invalidVersion = true;
  expect(await runAirflowAutomationTick(new Date("2026-10-15T10:01:00Z"))).toMatchObject({ errors: 1 });
  expect(f.trigger).not.toHaveBeenCalled();
});
it("does not overwrite an edited schedule after the provider accepted the original occurrence", async () => {
  f.advance.mockResolvedValue({ count: 0 });
  expect(await runAirflowAutomationTick(new Date("2026-10-15T10:01:00Z"))).toMatchObject({ errors: 1 });
  expect(f.trigger).toHaveBeenCalledOnce();
  expect(f.advance).toHaveBeenCalledWith({ where: { id: "rule", organizationId: "org", enabled: true, connectionId: "connection", updatedAt, nextScheduledAt: scheduledAt }, data: { nextScheduledAt: new Date("2026-10-15T11:00:00Z"), lastEvaluatedAt: new Date("2026-10-15T10:01:00Z") } });
  expect(f.update).not.toHaveBeenCalled();
});
