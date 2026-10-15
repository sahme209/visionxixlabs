import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), rules: vi.fn(), executions: vi.fn(), runs: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  airflowAutomation: { groupBy: async () => [{ organizationId: "org-1" }], findMany: mocks.rules, update: vi.fn() },
  airflowAutomationExecution: { findMany: mocks.executions, findUnique: async () => null, create: async () => ({ id: "new-1" }) },
  airflowDagRunSnapshot: { upsert: vi.fn() },
} }));
vi.mock("../connection", () => ({ loadAirflowClient: async () => ({ connectionId: "conn-1", client: { listDagRuns: mocks.runs } }) }));
vi.mock("../automationExecutor", () => ({ executeAirflowAutomation: mocks.execute }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: async () => undefined }));
import { runAirflowAutomationTick } from "../automationTick";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rules.mockResolvedValue([]);
  mocks.executions.mockImplementation(async ({ where }) => where.status === "failed" ? [{ id: "retry-1", decidedByUserId: "approver-1" }] : []);
  mocks.runs.mockResolvedValue([]);
});

describe("Airflow tick recorded outcomes", () => {
  it.each([
    [{ ok: true, result: {} }, 1, 0],
    [{ ok: false, error: "airflow_provider_outcome_unknown" }, 0, 1],
    [{ ok: false, error: "airflow_approval_authority_required" }, 0, 1],
    [{ ok: false, error: "airflow_execution_not_actionable" }, 0, 0],
    [{ ok: false, error: "airflow_automation_disabled" }, 0, 0],
  ])("counts retry result %j accurately", async (result, actions, errors) => {
    mocks.execute.mockResolvedValue(result);
    expect(await runAirflowAutomationTick()).toMatchObject({ actions, errors });
    expect(mocks.execute).toHaveBeenCalledWith("retry-1", "approver-1");
  });

  it("does not count a newly proposed action's uncertain outcome as success", async () => {
    mocks.rules.mockResolvedValue([{ id: "rule-1", name: "Fixture", dagId: "dag-1", triggerMode: "completion", dependencyDagIds: [], requiredDagState: "success", createdAt: new Date(0), actionType: "open_pull_request", approvalRequired: false }]);
    mocks.executions.mockResolvedValue([]);
    mocks.runs.mockResolvedValue([{ dagId: "dag-1", dagRunId: "run-1", state: "success", logicalDate: null, startedAt: null, endedAt: null }]);
    mocks.execute.mockResolvedValue({ ok: false, error: "airflow_provider_outcome_unknown" });
    expect(await runAirflowAutomationTick()).toMatchObject({ proposals: 1, actions: 0, errors: 1 });
  });
});
