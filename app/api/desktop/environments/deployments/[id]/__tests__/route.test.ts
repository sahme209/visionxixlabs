import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  findExecution: vi.fn(),
  updateExecution: vi.fn(),
  resolveToken: vi.fn(),
  getWorkflowRun: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveSession }));
vi.mock("@/lib/db", () => ({ prisma: {
  deploymentExecution: { findFirst: mocks.findExecution, updateMany: mocks.updateExecution },
  auditEvent: { create: vi.fn() },
} }));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  parseRepositoryFullName: (value: string) => value === "acme/widgets" ? { owner: "acme", repo: "widgets" } : null,
  resolveTenantScopedToken: mocks.resolveToken,
}));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ getWorkflowRun: mocks.getWorkflowRun }));
vi.mock("@/lib/releaseops/auditEventResponder", async () => {
  const actual = await vi.importActual<typeof import("@/lib/releaseops/auditEventResponder")>("@/lib/releaseops/auditEventResponder");
  return { ...actual, appendAuditEvent: mocks.appendAudit };
});

const execution = {
  id: "exec_1", organizationId: "org-1", environmentId: "env-1", repositoryFullName: "acme/widgets",
  workflowRunId: "123", workflowUrl: "https://github.test/runs/123", source: "desktop", triggeredByUserId: "user-1",
  status: "in_progress", conclusion: null, rollbackStatus: "not_started", lastObservedAt: null, completedAt: null,
  createdAt: new Date("2026-10-07T10:00:00Z"), updatedAt: new Date("2026-10-07T10:00:00Z"),
};

describe("GET /api/desktop/environments/deployments/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSession.mockResolvedValue({ userId: "user-1", organizationId: "org-1" });
    mocks.findExecution.mockResolvedValue(execution);
    mocks.resolveToken.mockResolvedValue({ ok: true, token: "scoped-token" });
    mocks.updateExecution.mockResolvedValue({ count: 1 });
    mocks.appendAudit.mockResolvedValue(true);
  });

  it("scopes the execution lookup to the authenticated tenant", async () => {
    mocks.getWorkflowRun.mockResolvedValue({ ok: true, data: {
      workflowRunId: "123", status: "in_progress", conclusion: null, rollback: "not_started",
      htmlUrl: execution.workflowUrl, createdAt: "2026-10-07T10:00:00Z", startedAt: "2026-10-07T10:00:02Z", updatedAt: "2026-10-07T10:02:00Z",
    } });
    const { GET } = await import("../route");
    const response = await GET(new NextRequest("https://visionxixlabs.com/api/desktop/environments/deployments/exec_1"), { params: Promise.resolve({ id: "exec_1" }) });
    expect(response.status).toBe(200);
    expect(mocks.findExecution).toHaveBeenCalledWith({ where: { id: "exec_1", organizationId: "org-1" } });
    expect(mocks.resolveToken).toHaveBeenCalledWith("org-1", { owner: "acme", repo: "widgets" });
  });

  it("persists terminal failure and successful rollback as auditable evidence", async () => {
    mocks.getWorkflowRun.mockResolvedValue({ ok: true, data: {
      workflowRunId: "123", status: "completed", conclusion: "failure", rollback: "succeeded",
      htmlUrl: execution.workflowUrl, createdAt: "2026-10-07T10:00:00Z", startedAt: "2026-10-07T10:00:02Z", updatedAt: "2026-10-07T10:08:00Z",
    } });
    const { GET } = await import("../route");
    const response = await GET(new NextRequest("https://visionxixlabs.com/api/desktop/environments/deployments/exec_1"), { params: Promise.resolve({ id: "exec_1" }) });
    const body = await response.json();
    expect(body.data).toEqual(expect.objectContaining({ status: "completed", conclusion: "failure", rollbackStatus: "succeeded" }));
    expect(mocks.updateExecution).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rollbackStatus: "succeeded" }) }));
    expect(mocks.appendAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "release.deploy_completed", outcome: "error" }));
  });

  it("does not reveal another tenant's execution", async () => {
    mocks.findExecution.mockResolvedValue(null);
    const { GET } = await import("../route");
    const response = await GET(new NextRequest("https://visionxixlabs.com/api/desktop/environments/deployments/exec_other"), { params: Promise.resolve({ id: "exec_other" }) });
    expect(response.status).toBe(404);
    expect(mocks.getWorkflowRun).not.toHaveBeenCalled();
  });
});
