import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), findRequired: vi.fn(), update: vi.fn(), claim: vi.fn(), openPR: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { airflowAutomationExecution: {
  findUnique: mocks.find, findUniqueOrThrow: mocks.findRequired, update: mocks.update, updateMany: mocks.claim,
} } }));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  parseRepositoryFullName: () => ({ owner: "fixture", repo: "repository" }),
  resolveTenantScopedToken: async () => ({ ok: true, token: "fixture-token" }),
}));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ createPullRequest: mocks.openPR, dispatchWorkflow: vi.fn() }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn() }));
import { executeAirflowAutomation } from "../automationExecutor";

let row: { id: string; organizationId: string; status: string; attempt: number; decidedByUserId: string | null };
const automation = {
  organizationId: "org-1", actionType: "open_pull_request", approvalRequired: false, enabled: true,
  repositoryFullName: "fixture/repository", sourceRef: "work", pullRequestBase: "main", pullRequestTitle: "Fixture proposal",
  maxRetries: 3, retryDelaySeconds: 60, notifyOnSuccess: false, notifyOnFailure: false, name: "Fixture automation",
};
const snapshot = () => ({ ...row, automation: { ...automation }, sourceDagId: "dag", sourceDagRunId: "run" });
function apply(data: Record<string, unknown>) {
  if (typeof data.status === "string") row.status = data.status;
  if (data.attempt) row.attempt += (data.attempt as { increment: number }).increment;
  if (typeof data.decidedByUserId === "string") row.decidedByUserId = data.decidedByUserId;
  return snapshot();
}

beforeEach(() => {
  vi.resetAllMocks();
  automation.enabled = true;
  row = { id: "execution-1", organizationId: "org-1", status: "queued", attempt: 0, decidedByUserId: null };
  mocks.find.mockImplementation(async () => snapshot());
  mocks.findRequired.mockImplementation(async () => snapshot());
  mocks.update.mockImplementation(async ({ data }) => apply(data));
  // Model the database compare-and-swap, including the observed attempt.
  mocks.claim.mockImplementation(async ({ where, data }) => {
    if (where.id !== row.id || where.organizationId !== row.organizationId || where.status !== row.status || where.attempt !== row.attempt || (where.automation?.enabled && !automation.enabled)) return { count: 0 };
    apply(data);
    return { count: 1 };
  });
  mocks.openPR.mockResolvedValue({ ok: true, data: { number: 1, htmlUrl: "https://github.com/fixture/repository/pull/1" } });
});

describe("Airflow execution claim", () => {
  it.each(["queued", "failed"])("does not execute a %s action after its automation is paused", async (status) => {
    row.status = status;
    row.decidedByUserId = "previous-approver";
    automation.enabled = false;
    expect(await executeAirflowAutomation(row.id, "previous-approver")).toEqual({ ok: false, error: "airflow_automation_disabled" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.openPR).not.toHaveBeenCalled();
    expect(row.attempt).toBe(0);
  });

  it("does not dispatch when the automation is paused between the read and claim", async () => {
    mocks.find.mockImplementationOnce(async () => {
      const observed = snapshot();
      automation.enabled = false;
      return observed;
    });
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: false });
    expect(mocks.openPR).not.toHaveBeenCalled();
    expect(row.attempt).toBe(0);
  });

  it("preserves retry eligibility when an authorized operator later re-enables the rule", async () => {
    row.status = "failed";
    automation.enabled = false;
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: false });
    automation.enabled = true;
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: true });
    expect(mocks.openPR).toHaveBeenCalledTimes(1);
    expect(row.attempt).toBe(1);
  });

  it("allows only one external action when two callers observe the same queued execution", async () => {
    const results = await Promise.all([executeAirflowAutomation(row.id), executeAirflowAutomation(row.id)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(mocks.openPR).toHaveBeenCalledTimes(1);
    expect(row.attempt).toBe(1);
  });

  it("does not execute an action rejected after the initial read", async () => {
    row.status = "pending_approval";
    mocks.find.mockImplementationOnce(async () => {
      const observed = snapshot();
      row.status = "rejected";
      return observed;
    });
    expect(await executeAirflowAutomation(row.id, "approver-1")).toMatchObject({ ok: false });
    expect(mocks.openPR).not.toHaveBeenCalled();
    expect(row.status).toBe("rejected");
  });

  it("requires an explicit approver to consume a pending approval", async () => {
    row.status = "pending_approval";
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_human_approval_required" });
    expect(mocks.openPR).not.toHaveBeenCalled();
    expect(row.status).toBe("pending_approval");
  });

  it("preserves the authorized pending-approval path", async () => {
    row.status = "pending_approval";
    expect(await executeAirflowAutomation(row.id, "approver-1")).toMatchObject({ ok: true });
    expect(row.decidedByUserId).toBe("approver-1");
    expect(mocks.openPR).toHaveBeenCalledTimes(1);
  });

  it("rejects a stale failed-attempt snapshot after another retry has already advanced it", async () => {
    row.status = "failed";
    mocks.find.mockImplementationOnce(async () => {
      const observed = snapshot();
      row.attempt += 1;
      return observed;
    });
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: false });
    expect(mocks.openPR).not.toHaveBeenCalled();
  });
});
