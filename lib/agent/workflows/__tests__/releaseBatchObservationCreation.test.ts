import { beforeEach, describe, expect, it, vi } from "vitest";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
const mocks = vi.hoisted(() => {
 const request = { findFirst: vi.fn() }, run = { findUnique: vi.fn(), upsert: vi.fn() }, event = { upsert: vi.fn() };
 return { request, run, event, tx: { tauriDeploymentRequest: request, durableAgentWorkflow: run, durableAgentWorkflowEvent: event } };
});
vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) } }));
import { ensureReleaseBatchObservation } from "../releaseBatchObservationCreation";
const intake = { id: "release", tenantId: "org", airflowDependency: { connectionId: "airflow", connectionUpdatedAt: "2026-10-24T09:00:00Z", runs: [{ dagId: "batch", dagRunId: "run", logicalDate: "2026-10-24T08:00:00Z" }] } };
const digest = sha256ContentHash({ requestVersion: 2, intake });
const input = { organizationId: "org", requestId: "release", expectedVersion: 2, expectedDigest: digest, requestedByUserId: "user", deadlineAt: 61000, now: new Date(1000) };
describe("stored release observation creation", () => {
 beforeEach(() => { vi.clearAllMocks(); mocks.request.findFirst.mockResolvedValue({ id: "release", organizationId: "org", version: 2, status: "submitted", intakeJson: intake }); mocks.run.findUnique.mockResolvedValue(null); mocks.run.upsert.mockImplementation(async args => args.create); });
 it("derives a stable identity and immutable binding from the stored tenant release", async () => {
  const row = await ensureReleaseBatchObservation(input);
  expect(row).toMatchObject({ workflowKind: "release_batch_observation_v1", currentStep: "observe_batches", inputJson: { requestId: "release", requestVersion: 2, intakeDigest: digest, startedAt: 1000, deadlineAt: 61000 }, stateJson: { observationCount: 0 }, attemptCount: 0 });
  expect(mocks.run.upsert.mock.calls[0][0]).toMatchObject({ update: {} });
  expect(mocks.event.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, create: expect.objectContaining({ sequence: 0 }) }));
 });
 it("returns the original binding on replay even after its deadline without resetting it", async () => {
  const row = await ensureReleaseBatchObservation(input); vi.clearAllMocks();
  mocks.request.findFirst.mockResolvedValue({ id: "release", organizationId: "org", version: 2, status: "submitted", intakeJson: intake }); mocks.run.findUnique.mockResolvedValue(row);
  expect(await ensureReleaseBatchObservation({ ...input, now: new Date(100000), deadlineAt: 200000 })).toEqual(row);
  expect(mocks.run.upsert).not.toHaveBeenCalled();
 });
 it("retries the whole deterministic transaction after a concurrent unique-key collision", async () => {
  mocks.run.upsert.mockRejectedValueOnce({ code: "P2002" });
  await expect(ensureReleaseBatchObservation(input)).resolves.toMatchObject({ inputJson: { startedAt: 1000, deadlineAt: 61000 } });
  expect(mocks.request.findFirst).toHaveBeenCalledTimes(2);
 });
 it("bounds collision retries and never retries unrelated failures", async () => {
  mocks.run.upsert.mockRejectedValue({ code: "P2002" });
  await expect(ensureReleaseBatchObservation(input)).rejects.toMatchObject({ code: "P2002" });
  expect(mocks.request.findFirst).toHaveBeenCalledTimes(3);
  vi.clearAllMocks(); mocks.run.upsert.mockRejectedValue(new Error("storage unavailable"));
  await expect(ensureReleaseBatchObservation(input)).rejects.toThrow("storage unavailable");
  expect(mocks.request.findFirst).toHaveBeenCalledTimes(1);
 });
 it("refuses stale, cross-tenant, incomplete or changed release snapshots", async () => {
  for (const patch of [{ version: 3 }, { organizationId: "other" }, { status: "draft" }, { intakeJson: { ...intake, airflowDependency: undefined } }]) {
   mocks.request.findFirst.mockResolvedValue({ id: "release", organizationId: "org", version: 2, status: "submitted", intakeJson: intake, ...patch });
   await expect(ensureReleaseBatchObservation(input)).rejects.toThrow();
  }
  expect(mocks.run.upsert).not.toHaveBeenCalled();
 });
});
