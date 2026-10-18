import { beforeEach, expect, it, vi } from "vitest";
import { requireCurrentRestartReview, fenceRestartDispatch, type ReviewDatabase } from "../restartReviewIO";
import { buildRestartReview } from "../restartReview";
const mocks = vi.hoisted(() => ({ ready: vi.fn(), read: vi.fn() }));
vi.mock("../restartReviewStore", () => ({ restartReviewReadiness: mocks.ready, readRestartReview: mocks.read }));
const rule = { id: "rule", organizationId: "org", connectionId: "connection", dagId: "dag", actionType: "deploy", environmentId: "env", repositoryFullName: "fixture/repo", sourceRef: "main", requiredDagState: "success", dependencyDagIds: [], approvalRequired: true, maxRetries: 3, retryDelaySeconds: 60 };
const source = { id: "execution", organizationId: "org", automationId: "rule", sourceDagId: "dag", sourceDagRunId: "run", sourceDagState: "success" };
const target = { kind: "ecs_restart_target" as const, organizationId: "org", environmentId: "env", environmentTier: "dev", targetId: "target", provider: "aws" as const, targetUpdatedAt: new Date(1).toISOString(), roleArn: "arn:aws:iam::123456789012:role/restart", region: "us-east-1", ecsCluster: "cluster-A", ecsService: "service-A" };
const connection = { id: "connection", baseUrl: "https://airflow.fixture.invalid", updatedAt: new Date(1).toISOString() };
const row = buildRestartReview(source, rule, connection, target);
const currentTarget = vi.fn(), saved = vi.fn(), lock = vi.fn();
function database() {
  return { $queryRawUnsafe: lock, environment: { findUnique: async () => ({ id: "env", organizationId: "org", tier: "dev" }) }, deploymentTarget: { findUnique: currentTarget },
    tenantIntegrationConnection: { findFirst: async () => ({ ...connection, updatedAt: new Date(1), scopesJson: { baseUrl: connection.baseUrl } }) },
    airflowAutomationExecution: { findFirst: async () => ({ ...source, status: "running", attempt: 1, automation: { ...rule, enabled: true } }), updateMany: saved } } as unknown as ReviewDatabase;
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.ready.mockResolvedValue("ready"); mocks.read.mockResolvedValue(row);
  currentTarget.mockResolvedValue({ ...target, id: target.targetId, updatedAt: new Date(1) });
  lock.mockResolvedValue([{ role: "admin" }]); saved.mockResolvedValue({ count: 1 });
});
it("uses the real shared target matcher and rejects a changed destination before intent", async () => {
  expect((await requireCurrentRestartReview(database(), source, rule, row.digest)).digest).toBe(row.digest);
  currentTarget.mockResolvedValue({ ...target, id: target.targetId, updatedAt: new Date(2), ecsService: "service-B" });
  await expect(requireCurrentRestartReview(database(), source, rule, row.digest)).rejects.toThrow("airflow_restart_review_stale");
  await expect(fenceRestartDispatch(database(), row, 1, "approver", {})).rejects.toThrow("airflow_restart_review_stale");
  expect(saved).not.toHaveBeenCalled();
});
it("writes durable reviewed intent only after the locked current-target and authority checks", async () => {
  await fenceRestartDispatch(database(), row, 1, "approver", { deploymentExecutionId: "reservation" });
  expect(lock.mock.calls[0][0]).toContain("FOR UPDATE OF e FOR SHARE OF a,n,t,c,m");
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "running", attempt: 1 }), data: { resultJson: { deploymentExecutionId: "reservation", reviewDigest: row.digest, phase: "dispatching" } } }));
});
it("never writes intent for removed membership, wrong digest, missing or absent storage", async () => {
  lock.mockResolvedValue([]); await expect(fenceRestartDispatch(database(), row, 1, "removed", {})).rejects.toThrow();
  await expect(requireCurrentRestartReview(database(), source, rule, "b".repeat(64))).rejects.toThrow("airflow_review_changed");
  mocks.read.mockResolvedValue(null); await expect(requireCurrentRestartReview(database(), source, rule, row.digest)).rejects.toThrow("airflow_review_required");
  mocks.ready.mockResolvedValue("not_installed"); await expect(requireCurrentRestartReview(database(), source, rule, row.digest)).rejects.toThrow("airflow_review_storage_unavailable");
  expect(saved).not.toHaveBeenCalled();
});
