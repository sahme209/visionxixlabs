import { describe, expect, it, vi } from "vitest";
import {
  releaseDeploymentDispatch,
  reserveDeploymentDispatch,
  settleDeploymentDispatch,
  type DeploymentReservationInput,
  type DeploymentReservationRepo,
} from "../deploymentDispatchReservation";

const input: DeploymentReservationInput = {
  organizationId: "org-1",
  idempotencyKey: "desktop-request-1",
  environmentId: "env-dev",
  repositoryFullName: "acme/widgets",
  sourceRef: "main",
  sourceKind: "branch",
  sourceCommitSha: "abc123",
  branchPolicyId: null,
  promotedFromExecutionId: null,
  pullRequestUrl: null,
  source: "desktop",
  triggeredByUserId: "user-1",
};

function repository(overrides?: { existing?: Record<string, unknown> | null; used?: number; tier?: string }) {
  const deploymentExecution = {
    findUnique: vi.fn(async () => overrides?.existing ?? null),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    count: vi.fn(async () => overrides?.used ?? 0),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      id: "exec-1",
      workflowRunId: null,
      workflowUrl: null,
      conclusion: null,
      rollbackStatus: "not_started",
      lastObservedAt: null,
      completedAt: null,
      createdAt: new Date("2026-10-12T12:00:00Z"),
      updatedAt: new Date("2026-10-12T12:00:00Z"),
    })),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };
  const repo = {
    tenantBillingPlan: { findUnique: vi.fn(async () => ({ tier: overrides?.tier ?? "trial", status: "active" })) },
    deploymentExecution,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      tenantBillingPlan: { findUnique: vi.fn(async () => ({ tier: overrides?.tier ?? "trial", status: "active" })) },
      deploymentExecution,
    })),
  } as unknown as DeploymentReservationRepo;
  return { repo, deploymentExecution };
}

describe("deployment dispatch reservations", () => {
  it("claims a Free-plan allowance slot inside a serializable transaction", async () => {
    const { repo, deploymentExecution } = repository({ used: 9 });
    const result = await reserveDeploymentDispatch(repo, input, new Date("2026-10-12T12:00:00Z"));
    expect(result).toMatchObject({ ok: true, reused: false, planId: "free", used: 9, limit: 10 });
    expect(repo.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(deploymentExecution.create).toHaveBeenCalledWith({ data: expect.objectContaining({ idempotencyKey: "desktop-request-1", status: "reserved" }) });
  });

  it("denies the final-plus-one request without creating a reservation", async () => {
    const { repo, deploymentExecution } = repository({ used: 10 });
    await expect(reserveDeploymentDispatch(repo, input)).resolves.toMatchObject({ ok: false, error: "deployment_quota_exhausted", used: 10, limit: 10 });
    expect(deploymentExecution.create).not.toHaveBeenCalled();
  });

  it("does not erase an old unresolved dispatch to free quota for another request", async () => {
    const { repo, deploymentExecution } = repository();
    let occupiedSlots = 10;
    // The tenth slot represents a dispatch whose provider outcome could not
    // be persisted. Age alone cannot establish that no external effect ran.
    deploymentExecution.deleteMany.mockImplementation(async () => {
      occupiedSlots -= 1;
      return { count: 1 };
    });
    deploymentExecution.count.mockImplementation(async () => occupiedSlots);
    await expect(reserveDeploymentDispatch(repo, { ...input, idempotencyKey: "unrelated-request" }, new Date("2026-10-15T12:00:00Z")))
      .resolves.toMatchObject({ ok: false, error: "deployment_quota_exhausted" });
    expect(deploymentExecution.deleteMany).not.toHaveBeenCalled();
    expect(deploymentExecution.create).not.toHaveBeenCalled();
  });

  it("returns a completed idempotent operation instead of reserving or dispatching again", async () => {
    const existing = { ...input, id: "exec-existing", status: "queued" };
    const { repo, deploymentExecution } = repository({ existing });
    await expect(reserveDeploymentDispatch(repo, input)).resolves.toMatchObject({ ok: true, reused: true, reservation: existing });
    expect(deploymentExecution.create).not.toHaveBeenCalled();
  });

  it("rejects reuse of a key for a different deployment payload", async () => {
    const existing = { ...input, id: "exec-existing", status: "queued", sourceRef: "release/old" };
    const { repo, deploymentExecution } = repository({ existing });
    await expect(reserveDeploymentDispatch(repo, input)).resolves.toMatchObject({ ok: false, error: "idempotency_key_conflict" });
    expect(deploymentExecution.create).not.toHaveBeenCalled();
  });

  it("releases failed dispatches and settles accepted dispatches with compare-and-set writes", async () => {
    const { repo, deploymentExecution } = repository();
    deploymentExecution.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(releaseDeploymentDispatch(repo, "org-1", "exec-1")).resolves.toBe(true);
    await expect(settleDeploymentDispatch(repo, "org-1", "exec-1", { workflowRunId: "run-1", workflowUrl: "https://github.test/run-1" })).resolves.toBe(true);
    expect(deploymentExecution.updateMany).toHaveBeenCalledWith({
      where: { id: "exec-1", organizationId: "org-1", status: "reserved" },
      data: { workflowRunId: "run-1", workflowUrl: "https://github.test/run-1", status: "queued" },
    });
  });
});
