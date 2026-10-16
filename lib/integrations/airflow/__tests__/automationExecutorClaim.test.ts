import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), findRequired: vi.fn(), update: vi.fn(), claim: vi.fn(), openPR: vi.fn(), token: vi.fn(), dispatch: vi.fn(), createDeployment: vi.fn(), membership: vi.fn(), reserve: vi.fn(), release: vi.fn(), settle: vi.fn(), airflow: vi.fn(), source: vi.fn(), dependencies: vi.fn(), binding: vi.fn() }));
vi.mock("../connection", () => ({ loadAirflowClient: mocks.airflow }));
vi.mock("@/lib/db", () => ({ prisma: { airflowAutomationExecution: {
  findUnique: mocks.find, findUniqueOrThrow: mocks.findRequired, update: mocks.update, updateMany: mocks.claim,
}, tenantIntegrationConnection: { findFirst: mocks.binding }, orgMembership: { findUnique: mocks.membership }, environment: { findFirst: async () => ({ id: "env-1", tier: "dev" }) }, deploymentTarget: { findFirst: async () => ({}) }, deploymentExecution: { create: mocks.createDeployment } } }));
vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  parseRepositoryFullName: () => ({ owner: "fixture", repo: "repository" }),
  resolveTenantScopedToken: mocks.token,
}));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ createPullRequest: mocks.openPR, dispatchWorkflow: mocks.dispatch }));
vi.mock("@/lib/releaseops/deploymentPolicyGuard", () => ({ evaluateDeploymentPolicy: async () => ({ ok: true, sourceCommitSha: "fixture-sha", policyId: "policy-1" }) }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn() }));
vi.mock("@/lib/billing/deploymentDispatchReservation", () => ({ reserveDeploymentDispatch: mocks.reserve, releaseDeploymentDispatch: mocks.release, settleDeploymentDispatch: mocks.settle }));
import { executeAirflowAutomation } from "../automationExecutor";

let row: { id: string; organizationId: string; status: string; attempt: number; decidedByUserId: string | null; nextRetryAt: Date | null; errorCode: string | null; resultJson: unknown };
const automation = {
  connectionId: "connection-1", dagId: "dag", requiredDagState: "success", dependencyDagIds: [] as string[], createdAt: new Date(0), updatedAt: new Date(1),
  organizationId: "org-1", actionType: "open_pull_request", approvalRequired: false, enabled: true,
  repositoryFullName: "fixture/repository", sourceRef: "work", pullRequestBase: "main", pullRequestTitle: "Fixture proposal",
  maxRetries: 3, retryDelaySeconds: 60, notifyOnSuccess: false, notifyOnFailure: false, name: "Fixture automation",
  environmentId: "env-1", createdByUserId: "user-1",
};
const snapshot = () => ({ ...row, automation: { ...automation }, sourceDagId: "dag", sourceDagRunId: "run", sourceDagState: "success" });
function apply(data: Record<string, unknown>) {
  if (typeof data.status === "string") row.status = data.status;
  if (data.attempt) row.attempt += (data.attempt as { increment: number }).increment;
  if (typeof data.decidedByUserId === "string") row.decidedByUserId = data.decidedByUserId;
  if ("nextRetryAt" in data) row.nextRetryAt = data.nextRetryAt as Date | null;
  if ("errorCode" in data) row.errorCode = data.errorCode as string | null;
  if ("resultJson" in data) row.resultJson = data.resultJson;
  return snapshot();
}

beforeEach(() => {
  vi.resetAllMocks();
  automation.dependencyDagIds = [];
  automation.requiredDagState = "success";
  automation.updatedAt = new Date(1);
  mocks.binding.mockResolvedValue({ id: "connection-1" });
  mocks.airflow.mockResolvedValue({ connectionId: "connection-1", connectionUpdatedAt: new Date(1), client: { getDagRun: mocks.source, listDagRuns: mocks.dependencies } });
  mocks.source.mockResolvedValue({ dagId: "dag", dagRunId: "run", state: "success", logicalDate: "2026-10-15T10:00:00Z" });
  mocks.dependencies.mockResolvedValue([{ dagId: "upstream", dagRunId: "upstream-run", state: "success", logicalDate: "2026-10-15T10:00:00Z" }]);
  automation.enabled = true;
  automation.actionType = "open_pull_request";
  automation.approvalRequired = false;
  row = { id: "execution-1", organizationId: "org-1", status: "queued", attempt: 0, decidedByUserId: null, nextRetryAt: null, errorCode: null, resultJson: null };
  mocks.find.mockImplementation(async () => snapshot());
  mocks.findRequired.mockImplementation(async () => snapshot());
  mocks.update.mockImplementation(async ({ data }) => apply(data));
  // Model the database compare-and-swap, including the observed attempt.
  mocks.claim.mockImplementation(async ({ where, data }) => {
    if ((where.automation?.updatedAt && where.automation.updatedAt.getTime() !== automation.updatedAt.getTime()) || where.id !== row.id || where.organizationId !== row.organizationId || where.status !== row.status || where.attempt !== row.attempt || (where.automation?.enabled && !automation.enabled)) return { count: 0 };
    apply(data);
    return { count: 1 };
  });
  mocks.openPR.mockResolvedValue({ ok: true, data: { number: 1, htmlUrl: "https://github.com/fixture/repository/pull/1" } });
  mocks.token.mockResolvedValue({ ok: true, token: "fixture-token" });
  mocks.dispatch.mockResolvedValue({ ok: true, data: { workflowRunId: "run-1", htmlUrl: "https://github.com/fixture/repository/actions/runs/1" } });
  mocks.createDeployment.mockResolvedValue({ id: "deployment-1" });
  mocks.membership.mockResolvedValue({ role: "admin", acceptedAt: new Date() });
  mocks.reserve.mockResolvedValue({ ok: true, reused: false, reservation: { id: "deployment-1" } });
  mocks.release.mockResolvedValue(true);
  mocks.settle.mockResolvedValue(true);
});

describe("Airflow execution claim", () => {
  it("blocks deployment before dispatch when the shared allowance is exhausted", async () => {
    automation.actionType = "deploy";
    mocks.reserve.mockResolvedValue({ ok: false, error: "deployment_quota_exhausted" });
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "deployment_quota_exhausted" });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("retains the shared hold and reservation reference after an uncertain provider response", async () => {
    automation.actionType = "deploy";
    mocks.dispatch.mockResolvedValue({ ok: false, error: "workflow_dispatch_failed: fetch failed" });
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_provider_outcome_unknown" });
    expect(row.status).toBe("needs_reconciliation");
    expect(row.resultJson).toMatchObject({ deploymentExecutionId: "deployment-1", phase: "outcome_unconfirmed" });
    expect(mocks.release).not.toHaveBeenCalled();
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: false });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });

  it("uses a stable execution key and settles the same reserved deployment", async () => {
    automation.actionType = "deploy";
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: true });
    expect(mocks.reserve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "org-1", idempotencyKey: "airflow-execution:execution-1", sourceCommitSha: "fixture-sha" }));
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), "org-1", "deployment-1", expect.objectContaining({ workflowRunId: "run-1" }));
    expect(mocks.createDeployment).not.toHaveBeenCalled();
  });

  it("links an already recorded deployment without dispatching another workflow", async () => {
    automation.actionType = "deploy";
    mocks.reserve.mockResolvedValue({ ok: true, reused: true, reservation: { id: "deployment-existing", workflowUrl: "https://github.test/run", workflowRunId: "recorded-run" } });
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: true, result: { deploymentExecutionId: "deployment-existing", replayed: true } });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("releases a newly reserved slot if its durable dispatch intent cannot be saved", async () => {
    automation.actionType = "deploy";
    mocks.update.mockImplementation(async ({ data }) => {
      if (data.resultJson?.phase === "dispatching") throw new Error("intent_store_unavailable");
      return apply(data);
    });
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "intent_store_unavailable" });
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledWith(expect.anything(), "org-1", "deployment-1");
  });
  it.each([null, { role: "admin", acceptedAt: null }, { role: "read_only", acceptedAt: new Date() }, { role: "operator", acceptedAt: new Date() }])("does not reuse approval after membership or approval capability is lost", async (membership) => {
    row.status = "failed";
    row.decidedByUserId = "previous-approver";
    automation.approvalRequired = true;
    mocks.membership.mockResolvedValue(membership);
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_approval_authority_required" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.openPR).not.toHaveBeenCalled();
  });

  it("fails closed when current approval authority cannot be read", async () => {
    row.decidedByUserId = "previous-approver";
    mocks.membership.mockRejectedValue(new Error("membership_store_unavailable"));
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_approval_authority_unavailable" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.openPR).not.toHaveBeenCalled();
  });

  it("rechecks an accepted approver in the execution's exact workspace before retry", async () => {
    row.status = "failed";
    row.decidedByUserId = "previous-approver";
    automation.approvalRequired = true;
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: true });
    expect(mocks.membership).toHaveBeenCalledWith({ where: { userId_organizationId: { userId: "previous-approver", organizationId: "org-1" } }, select: { acceptedAt: true, role: true } });
    expect(mocks.openPR).toHaveBeenCalledTimes(1);
  });

  it("does not automatically retry an approval-required action with no recorded approver", async () => {
    row.status = "failed";
    automation.approvalRequired = true;
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_human_approval_required" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.openPR).not.toHaveBeenCalled();
  });

  it("never sends the provider request if its dispatch intent cannot be persisted", async () => {
    mocks.update.mockImplementation(async ({ data }) => {
      if (data.resultJson?.phase === "dispatching") throw new Error("intent_store_unavailable");
      return apply(data);
    });
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "intent_store_unavailable" });
    expect(mocks.openPR).not.toHaveBeenCalled();
    expect(row.status).toBe("failed");
    expect(row.nextRetryAt).toBeInstanceOf(Date);
  });

  it("leaves a durable running intent if both completion and reconciliation storage fail", async () => {
    mocks.update.mockImplementation(async ({ data }) => {
      if (data.status === "succeeded" || data.status === "needs_reconciliation") throw new Error("storage_unavailable");
      return apply(data);
    });
    await expect(executeAirflowAutomation(row.id)).rejects.toThrow("storage_unavailable");
    expect(row.status).toBe("running");
    expect(row.resultJson).toMatchObject({ action: "open_pull_request", phase: "dispatching" });
    expect(row.nextRetryAt).toBeNull();
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: false });
    expect(mocks.openPR).toHaveBeenCalledTimes(1);
  });

  it("does not redispatch a workflow when deployment tracking storage fails", async () => {
    automation.actionType = "deploy";
    mocks.settle.mockResolvedValue(false);
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_provider_outcome_unknown" });
    expect(row.status).toBe("needs_reconciliation");
    expect(row.resultJson).toMatchObject({ action: "deploy", workflowRunId: "run-1" });
    expect(row.nextRetryAt).toBeNull();
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: false });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("holds an action for reconciliation when the provider response times out", async () => {
    mocks.openPR.mockRejectedValue(new Error("network_timeout"));
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_provider_outcome_unknown" });
    expect(row.status).toBe("needs_reconciliation");
    expect(row.nextRetryAt).toBeNull();
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: false });
    expect(mocks.openPR).toHaveBeenCalledTimes(1);
  });

  it("retains the known provider receipt and blocks replay if completion storage fails", async () => {
    mocks.update.mockImplementation(async ({ data }) => {
      if (data.status === "succeeded") throw new Error("storage_unavailable");
      return apply(data);
    });
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_provider_outcome_unknown" });
    expect(row.status).toBe("needs_reconciliation");
    expect(row.nextRetryAt).toBeNull();
    expect(row.resultJson).toMatchObject({ action: "open_pull_request", pullRequestNumber: 1 });
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: false });
    expect(mocks.openPR).toHaveBeenCalledTimes(1);
  });

  it("preserves bounded retries for failures before a provider action starts", async () => {
    mocks.token.mockResolvedValueOnce({ ok: false, error: "installation_unavailable" });
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "installation_unavailable" });
    expect(row.status).toBe("failed");
    expect(row.nextRetryAt).toBeInstanceOf(Date);
    expect(mocks.openPR).not.toHaveBeenCalled();
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: true });
    expect(mocks.openPR).toHaveBeenCalledTimes(1);
  });

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

describe("dispatch-time current Airflow preconditions", () => {
  it("refuses a source cleared or failed after proposal before claiming or resolving credentials", async () => {
    mocks.source.mockResolvedValue({ dagId: "dag", dagRunId: "run", state: "failed", logicalDate: "2026-10-15T10:00:00Z" });
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_source_not_ready" });
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.openPR).not.toHaveBeenCalled(); expect(mocks.reserve).not.toHaveBeenCalled();
    expect(row.status).toBe("queued"); expect(row.attempt).toBe(0);
  });
  it("refuses a dependency that became failed after proposal", async () => {
    automation.dependencyDagIds = ["upstream"];
    mocks.dependencies.mockResolvedValue([{ dagId: "upstream", state: "failed", logicalDate: "2026-10-15T10:00:00Z" }]);
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_dependencies_not_ready" });
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.dispatch).not.toHaveBeenCalled(); expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("fails closed when current Airflow cannot be read", async () => {
    mocks.airflow.mockRejectedValue(new Error("airflow_not_connected"));
    expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_preconditions_unavailable" });
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
  });
  it("retains no-dependency null-date manual support", async () => {
    mocks.source.mockResolvedValue({ dagId: "dag", dagRunId: "run", state: "success", logicalDate: null });
    expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: true });
    expect(mocks.openPR).toHaveBeenCalledTimes(1);
  });
});

it.each(["failed", "any"])("preserves configured %s source completion semantics", async (required) => {
  automation.requiredDagState = required;
  mocks.find.mockImplementation(async () => ({ ...snapshot(), sourceDagState: "failed" }));
  mocks.source.mockResolvedValue({ dagId: "dag", dagRunId: "run", state: "failed", logicalDate: "2026-10-15T10:00:00Z" });
  expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: true });
});
it("does not require remote dependency reads for read-only none actions", async () => {
  automation.actionType = "none";
  mocks.airflow.mockRejectedValue(new Error("unavailable"));
  expect(await executeAirflowAutomation(row.id)).toMatchObject({ ok: true });
  expect(mocks.airflow).not.toHaveBeenCalled();
});
it("refuses a revoked or changed connection after reading provider evidence", async () => {
  mocks.binding.mockResolvedValue(null);
  expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_connection_changed" });
  expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.reserve).not.toHaveBeenCalled();
});
it("fences a rule revision changed during remote reads before any write", async () => {
  mocks.source.mockImplementation(async () => {
    automation.updatedAt = new Date(2);
    return { dagId: "dag", dagRunId: "run", state: "success", logicalDate: null };
  });
  expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_execution_not_actionable" });
  expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.reserve).not.toHaveBeenCalled();
});
it.each([null, "invalid", "2026-10-15T09:00:00Z"])("refuses missing/malformed/stale dependency timestamp %s at dispatch", async (logicalDate) => {
  automation.dependencyDagIds = ["upstream"];
  mocks.dependencies.mockResolvedValue([{ dagId: "upstream", state: "success", logicalDate }]);
  expect(await executeAirflowAutomation(row.id)).toEqual({ ok: false, error: "airflow_dependencies_not_ready" });
  expect(mocks.claim).not.toHaveBeenCalled();
});
it("denies approval authority revoked while remote source evidence is read", async () => {
  automation.approvalRequired = true;
  mocks.source.mockImplementation(async () => {
    mocks.membership.mockResolvedValue({ role: "read_only", acceptedAt: new Date() });
    return { dagId: "dag", dagRunId: "run", state: "success", logicalDate: null };
  });
  expect(await executeAirflowAutomation(row.id, "approver")).toEqual({ ok: false, error: "airflow_approval_authority_required" });
  expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.openPR).not.toHaveBeenCalled(); expect(mocks.dispatch).not.toHaveBeenCalled();
  expect(row.status).toBe("queued"); expect(row.attempt).toBe(0);
});
