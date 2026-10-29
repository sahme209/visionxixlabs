import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => { const run = { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() }; const event = { create: vi.fn() }; return { run, event, tx: { durableAgentWorkflow: run, durableAgentWorkflowEvent: event } }; });
vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (fn: (tx: typeof m.tx) => unknown) => fn(m.tx) } }));
import { cancelReleaseBatchObservation } from "../releaseBatchObservationCancellation";
const binding = { requestId: "release", requestVersion: 2, intakeDigest: "a".repeat(64), startedAt: 1000, deadlineAt: 61000 };
const input = { organizationId: "org", requestId: "release", workflowRunId: "wait", expectedVersion: 3, actorUserId: "creator", now: new Date(2000) };
describe("own saved batch wait cancellation", () => {
 beforeEach(() => { vi.clearAllMocks(); m.run.findFirst.mockResolvedValue({ id: "wait", organizationId: "org", requestedByUserId: "creator", workflowKind: "release_batch_observation_v1", version: 3, status: "running", inputJson: binding }); m.run.updateMany.mockResolvedValue({ count: 1 }); });
 it("atomically terminates the read-only wait, invalidates its lease and appends user evidence", async () => {
  await cancelReleaseBatchObservation(input);
  expect(m.run.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ organizationId: "org", id: "wait", version: 3, requestedByUserId: "creator", workflowKind: "release_batch_observation_v1", inputJson: { equals: binding } }), data: expect.objectContaining({ status: "cancelled", currentStep: "cancelled", leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: null, cancelRequestedAt: input.now, cancelledAt: input.now, version: { increment: 1 } }) });
  expect(m.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sequence: 4, actorKind: "user", actorId: "creator", eventType: "release_batch.cancelled" }) });
 });
 it("refuses another creator, tenant, request binding or stale version", async () => {
  for (const patch of [{ requestedByUserId: "other" }, { organizationId: "other" }, { version: 4 }, { inputJson: { ...binding, requestId: "other" } }]) {
   m.run.findFirst.mockResolvedValue({ id: "wait", organizationId: "org", requestedByUserId: "creator", workflowKind: "release_batch_observation_v1", version: 3, status: "running", inputJson: binding, ...patch });
   await expect(cancelReleaseBatchObservation(input)).rejects.toThrow();
  }
  expect(m.run.updateMany).not.toHaveBeenCalled();
 });
 it("does not append evidence when the worker wins the version race", async () => {
  m.run.updateMany.mockResolvedValue({ count: 0 }); await expect(cancelReleaseBatchObservation(input)).rejects.toThrow(); expect(m.event.create).not.toHaveBeenCalled();
 });
});
