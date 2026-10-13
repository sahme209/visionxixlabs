import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const durable = {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  };
  const event = { create: vi.fn() };
  const proposal = { findFirst: vi.fn() };
  const tx = {
    durableAgentWorkflow: durable,
    durableAgentWorkflowEvent: event,
    agentActionProposal: proposal,
  };
  return { durable, event, proposal, tx };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    durableAgentWorkflow: mocks.durable,
    $transaction: vi.fn(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx)),
  },
}));

import {
  DurableWorkflowConflictError,
  checkpointDurableWorkflow,
  claimDurableWorkflow,
  requestDurableWorkflowCancellation,
  resumeDurableWorkflowFromApproval,
} from "@/lib/agent/workflows/durableWorkflowStore";

const now = new Date("2026-10-13T19:30:00.000Z");

describe("durableWorkflowStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.durable.findUniqueOrThrow.mockResolvedValue({ id: "run_1", version: 2 });
    mocks.event.create.mockResolvedValue({ id: "event_1" });
  });

  it("claims a due workflow with a bounded lease and version CAS", async () => {
    mocks.durable.findFirst.mockResolvedValue({ attemptCount: 0, maxAttempts: 3 });
    mocks.durable.updateMany.mockResolvedValue({ count: 1 });

    const run = await claimDurableWorkflow({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 1,
      workerId: "worker_1",
      leaseDurationMs: 30_000,
      now,
    });

    expect(run).toEqual({ id: "run_1", version: 2 });
    expect(mocks.durable.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org_1", version: 1, attemptCount: 0 }),
      data: expect.objectContaining({
        status: "running",
        leaseOwner: "worker_1",
        leaseExpiresAt: new Date("2026-10-13T19:30:30.000Z"),
        version: { increment: 1 },
      }),
    }));
    expect(mocks.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sequence: 2 }) });
  });

  it("does not claim an exhausted workflow", async () => {
    mocks.durable.findFirst.mockResolvedValue({ attemptCount: 3, maxAttempts: 3 });

    await expect(claimDurableWorkflow({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 4,
      workerId: "worker_1",
      now,
    })).resolves.toBeNull();
    expect(mocks.durable.updateMany).not.toHaveBeenCalled();
    expect(mocks.event.create).not.toHaveBeenCalled();
  });

  it("rejects a stale worker checkpoint without writing audit evidence", async () => {
    mocks.durable.updateMany.mockResolvedValue({ count: 0 });

    await expect(checkpointDurableWorkflow({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 2,
      workerId: "worker_1",
      state: { result: "verified" },
      status: "completed",
      now,
    })).rejects.toBeInstanceOf(DurableWorkflowConflictError);
    expect(mocks.event.create).not.toHaveBeenCalled();
  });

  it("fails closed when an approval is missing or expired", async () => {
    mocks.proposal.findFirst.mockResolvedValue(null);

    await expect(resumeDurableWorkflowFromApproval({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 3,
      approvalProposalId: "approval_1",
      now,
    })).rejects.toThrow("valid, unexpired approval");
    expect(mocks.durable.updateMany).not.toHaveBeenCalled();
  });

  it("invalidates a worker version when cancellation is requested", async () => {
    mocks.durable.updateMany.mockResolvedValue({ count: 1 });

    await requestDurableWorkflowCancellation({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 2,
      actorUserId: "admin_1",
      now,
    });

    expect(mocks.durable.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ version: 2, cancelRequestedAt: null }),
      data: { cancelRequestedAt: now, version: { increment: 1 } },
    }));
    expect(mocks.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      sequence: 3,
      eventType: "workflow.cancellation_requested",
      actorId: "admin_1",
    }) });
  });
});
