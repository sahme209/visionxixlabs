import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
 const run = { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() };
 const event = { create: vi.fn() }; return { run, event, tx: { durableAgentWorkflow: run, durableAgentWorkflowEvent: event } };
});
vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) } }));
import { checkpointReleaseBatchObservation } from "../releaseBatchObservationCheckpoint";
const binding = { requestId: "release", requestVersion: 2, intakeDigest: "a".repeat(64), startedAt: 1000, deadlineAt: 61000 };
const input = { organizationId: "org", workflowRunId: "wait", workerId: "reader", expectedVersion: 3, observation: "waiting" as const, now: new Date(2000) };
describe("batch observation checkpoint", () => {
 beforeEach(() => { vi.clearAllMocks(); mocks.run.findFirst.mockResolvedValue({ inputJson: binding, stateJson: { observationCount: 20 } }); mocks.run.updateMany.mockResolvedValue({ count: 1 }); });
 it("persists observation count and next read without changing immutable input or write attempts", async () => {
  await checkpointReleaseBatchObservation(input);
  const change = mocks.run.updateMany.mock.calls[0][0];
  expect(change.where).toMatchObject({ organizationId: "org", version: 3, workflowKind: "release_batch_observation_v1", leaseOwner: "reader", leaseExpiresAt: { gt: input.now }, cancelRequestedAt: null, inputJson: { equals: binding } });
  expect(change.data).toMatchObject({ status: "retrying", stateJson: { observationCount: 21, phase: "waiting" }, nextAttemptAt: new Date(17000), leaseOwner: null });
  expect(change.data).not.toHaveProperty("attemptCount"); expect(change.data).not.toHaveProperty("inputJson");
  expect(mocks.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sequence: 4, eventType: "release_batch.waiting" }) });
 });
 it("accepts the prior waiting checkpoint on the next observation", async () => {
  mocks.run.findFirst.mockResolvedValue({ inputJson: binding, stateJson: { observationCount: 21, phase: "waiting" } });
  await expect(checkpointReleaseBatchObservation(input)).resolves.not.toThrow();
 });
 it("ready pauses for a fresh preflight, never approval or execution", async () => {
  await checkpointReleaseBatchObservation({ ...input, observation: "ready" });
  expect(mocks.run.updateMany.mock.calls[0][0].data).toMatchObject({ status: "paused_for_input", currentStep: "preflight_required", approvalProposalId: null, nextAttemptAt: null });
 });
 it("expired lease or cancellation CAS failure cannot append an event", async () => {
  mocks.run.updateMany.mockResolvedValue({ count: 0 });
  await expect(checkpointReleaseBatchObservation(input)).rejects.toThrow(); expect(mocks.event.create).not.toHaveBeenCalled();
 });
 it("refuses malformed stored bindings and counters", async () => {
  for (const row of [{ inputJson: { ...binding, requestVersion: 0 }, stateJson: {} }, { inputJson: binding, stateJson: { observationCount: -1 } }]) {
   mocks.run.findFirst.mockResolvedValue(row); await expect(checkpointReleaseBatchObservation(input)).rejects.toThrow();
  }
  expect(mocks.run.updateMany).not.toHaveBeenCalled();
 });
});
