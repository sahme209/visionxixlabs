import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rules: vi.fn(), existing: vi.fn(), create: vi.fn(), query: vi.fn(), readiness: vi.fn(), execute: vi.fn(), committed: [] as unknown[], staged: [] as unknown[], transaction: vi.fn() }));
vi.mock("@/lib/db", () => {
  const db = {
    airflowAutomation: { groupBy: async () => [{ organizationId: "org" }], findMany: mock.rules, update: vi.fn() },
    airflowAutomationExecution: { findUnique: mock.existing, create: mock.create, findMany: async () => [] },
    airflowDagRunSnapshot: { upsert: vi.fn() },
    tenantIntegrationConnection: { findFirst: async () => ({ id: "connection", updatedAt: new Date(1), scopesJson: { baseUrl: "https://airflow.fixture.invalid" } }) },
    environment: { findUnique: async () => ({ id: "env", organizationId: "org", tier: "dev" }) },
    deploymentTarget: { findUnique: async () => ({ id: "target", organizationId: "org", provider: "aws", updatedAt: new Date(1), roleArn: "role-A", region: "us-east-1", ecsCluster: "cluster-A", ecsService: "service-A" }) },
    $queryRawUnsafe: mock.query,
    $transaction: mock.transaction,
  };
  mock.transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => { mock.staged = []; try { const result = await work(db); mock.committed.push(...mock.staged); return result; } finally { mock.staged = []; } });
  return { prisma: db };
});
vi.mock("../restartReviewStore", async importOriginal => ({ ...await importOriginal<typeof import("../restartReviewStore")>(), restartReviewReadiness: mock.readiness }));
vi.mock("../connection", () => ({ loadAirflowClient: async () => ({ connectionId: "connection", connectionUpdatedAt: new Date(1), baseUrl: "https://airflow.fixture.invalid", client: { listDagRuns: async () => [{ dagId: "dag", dagRunId: "run", state: "success", logicalDate: null, startedAt: "2026-10-15T10:00:00Z", endedAt: null }] } }) }));
vi.mock("../automationExecutor", () => ({ executeAirflowAutomation: mock.execute }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: async () => undefined }));
import { runAirflowAutomationTick } from "../automationTick";
const rule = { id: "rule", name: "Fixture", organizationId: "org", connectionId: "connection", dagId: "dag", actionType: "deploy", environmentId: "env", repositoryFullName: "fixture/repo", sourceRef: "main", requiredDagState: "success", dependencyDagIds: [], approvalRequired: false, maxRetries: 3, retryDelaySeconds: 60, createdAt: new Date(0) };
beforeEach(() => {
  vi.clearAllMocks(); mock.committed = []; mock.staged = []; mock.rules.mockResolvedValue([rule]); mock.existing.mockResolvedValue(null); mock.readiness.mockResolvedValue("ready");
  mock.create.mockImplementation(async ({ data }) => { const execution = { ...data, id: "execution", attempt: 0 }; mock.staged.push(execution); return execution; });
  mock.query.mockImplementation(async (_sql, ...values) => { mock.staged.push(JSON.parse(values[3])); return [{ executionId: values[0] }]; });
});
it("the actual scheduler captures immutable target evidence in the execution transaction and always requires human review", async () => {
  expect(await runAirflowAutomationTick()).toMatchObject({ proposals: 1, actions: 0, errors: 0 });
  expect(mock.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  expect(mock.committed).toEqual([expect.objectContaining({ status: "pending_approval", sourceDagRunId: "run" }), expect.objectContaining({ executionId: "execution", target: expect.objectContaining({ ecsService: "service-A" }) })]);
  expect(mock.execute).not.toHaveBeenCalled();
});
it("rolls back parent creation if sidecar persistence fails", async () => {
  mock.query.mockRejectedValueOnce(new Error("sidecar_write_failed"));
  expect(await runAirflowAutomationTick()).toMatchObject({ proposals: 0, actions: 0, errors: 1 });
  expect(mock.create).toHaveBeenCalledOnce(); expect(mock.committed).toEqual([]);
});
it("refuses absent storage before creating a new action and never backfills an existing execution", async () => {
  mock.readiness.mockResolvedValue("not_installed");
  expect(await runAirflowAutomationTick()).toMatchObject({ proposals: 0, errors: 1 }); expect(mock.create).not.toHaveBeenCalled();
  mock.existing.mockResolvedValue({ id: "historical" });
  expect(await runAirflowAutomationTick()).toMatchObject({ proposals: 0, errors: 0 }); expect(mock.query).not.toHaveBeenCalled();
});
