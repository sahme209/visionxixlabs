import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const run = { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() };
  const event = { create: vi.fn() };
  return { run, event, tx: { durableAgentWorkflow: run, durableAgentWorkflowEvent: event } };
});
vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) } }));
import { claimReleaseBatchObservation } from "../releaseBatchObservationLease";
const now = new Date("2026-10-24T09:00:00Z");
const input = { organizationId: "org", workflowRunId: "wait", expectedVersion: 3, workerId: "reader", now };
describe("reserved batch observation lease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.updateMany.mockResolvedValue({ count: 1 });
    mocks.run.findUniqueOrThrow.mockResolvedValue({ id: "wait", version: 4 });
  });
  it("claims only the reserved read-only phase with tenant, version, due and cancellation fences", async () => {
    await claimReleaseBatchObservation(input);
    expect(mocks.run.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId: "org", id: "wait", version: 3,
        workflowKind: "release_batch_observation_v1", currentStep: "observe_batches", cancelRequestedAt: null,
        status: { in: ["queued", "running", "retrying"] }, AND: expect.any(Array) }),
      data: { status: "running", leaseOwner: "reader", leaseExpiresAt: new Date(now.getTime() + 60_000), version: { increment: 1 } },
    });
    expect(mocks.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sequence: 4, eventType: "release_batch.observation_lease_acquired" }) });
    expect(mocks.run.findFirst).not.toHaveBeenCalled();
  });
  it("losing the CAS writes no event and returns no row", async () => {
    mocks.run.updateMany.mockResolvedValue({ count: 0 });
    expect(await claimReleaseBatchObservation(input)).toBeNull();
    expect(mocks.event.create).not.toHaveBeenCalled();
    expect(mocks.run.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it("rejects invalid identities, versions and clocks before storage", async () => {
    for (const patch of [{ organizationId: " " }, { workerId: "" }, { expectedVersion: -1 }, { expectedVersion: 1.5 }, { now: new Date(NaN) }]) {
      await expect(claimReleaseBatchObservation({ ...input, ...patch })).rejects.toThrow();
    }
    expect(mocks.run.updateMany).not.toHaveBeenCalled();
  });
});
