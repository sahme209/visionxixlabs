import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), review: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.session }));
vi.mock("@/lib/db", () => ({ prisma: { airflowAutomationExecution: { findFirst: mocks.find } } }));
vi.mock("@/lib/integrations/airflow/restartReviewIO", () => ({ requireCurrentRestartReview: mocks.review }));
vi.mock("@/lib/integrations/airflow/automationExecutor", () => ({ executeAirflowAutomation: mocks.execute }));
import { GET } from "../route";
import { POST } from "../../approve/route";
const context = { params: Promise.resolve({ id: "execution" }) };
const request = (body?: unknown) => new NextRequest("https://fixture.invalid/api", body === undefined ? {} : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.resetAllMocks(); mocks.session.mockResolvedValue({ organizationId: "org", userId: "approver" });
  mocks.find.mockResolvedValue({ id: "execution", organizationId: "org", automation: { actionType: "deploy", enabled: true, repositoryFullName: "fixture/repo", sourceRef: "main" } });
  mocks.review.mockResolvedValue({ digest: "a".repeat(64), payload: { source: { dagId: "dag", runId: "run", state: "success" }, target: { roleArn: "arn:aws:iam::123456789012:role/restart", ecsService: "service-A" } } });
  mocks.execute.mockResolvedValue({ ok: true, result: { evidence: { requestedOperation: "service_restart" } } });
});
it("requires current paired identity before optional review reads", async () => {
  mocks.session.mockResolvedValue(undefined); expect((await GET(request(), context)).status).toBe(401);
  expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.review).not.toHaveBeenCalled();
});
it("returns only the tenant's exact target review without caching", async () => {
  const response = await GET(request(), context); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json()).data).toMatchObject({ digest: "a".repeat(64), requestedOperation: "service_restart", target: { ecsService: "service-A" } });
  expect(mocks.session.mock.calls[0][1]).toMatchObject({ requiredScope: "pipeline:read", requiredCapability: "workspace:read", allowApiKey: false });
  mocks.find.mockResolvedValue(null); expect((await GET(request(), context)).status).toBe(404);
});
it("maps missing storage and historical review to bounded refusal while rejection remains independent", async () => {
  mocks.review.mockRejectedValue(new Error("airflow_review_storage_unavailable")); expect((await GET(request(), context)).status).toBe(503);
  mocks.review.mockRejectedValue(new Error("airflow_review_required")); expect((await GET(request(), context)).status).toBe(409);
});
it("requires the displayed digest for a restart and forwards it with the authenticated actor", async () => {
  expect((await POST(request({}), context)).status).toBe(409); expect(mocks.execute).not.toHaveBeenCalled();
  expect((await POST(request({ expectedReviewDigest: "a".repeat(64) }), context)).status).toBe(200);
  expect(mocks.execute).toHaveBeenCalledWith("execution", "approver", "a".repeat(64));
  mocks.execute.mockResolvedValue({ ok: false, error: "airflow_restart_review_stale" });
  expect((await POST(request({ expectedReviewDigest: "a".repeat(64) }), context)).status).toBe(409);
});
it("preserves the non-restart approval call without a new evidence requirement", async () => {
  mocks.find.mockResolvedValue({ id: "execution", automation: { actionType: "open_pull_request" } });
  expect((await POST(request({}), context)).status).toBe(200);
  expect(mocks.execute).toHaveBeenCalledWith("execution", "approver");
});
