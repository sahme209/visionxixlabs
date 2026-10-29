import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), worker: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { durableAgentWorkflow: { findMany: m.find } } }));
vi.mock("../releaseBatchObservationWorker", () => ({ runReleaseBatchObservation: m.worker }));
import { runReleaseBatchObservationTick } from "../releaseBatchObservationTick";
describe("opt-in bounded observation tick", () => {
 beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AXIOM_RELEASE_BATCH_WAITS_ENABLED", "true"); m.find.mockResolvedValue([{ id: "one", organizationId: "org", version: 2 }]); m.worker.mockResolvedValue({ observed: true }); });
 afterEach(() => vi.unstubAllEnvs());
 it("does no storage or provider work unless explicitly enabled", async () => {
  vi.stubEnv("AXIOM_RELEASE_BATCH_WAITS_ENABLED", "false"); expect(await runReleaseBatchObservationTick()).toMatchObject({ enabled: false, inspected: 0 }); expect(m.find).not.toHaveBeenCalled(); expect(m.worker).not.toHaveBeenCalled();
 });
 it("selects only due reserved observation steps and binds each call to the stored tenant/version", async () => {
  expect(await runReleaseBatchObservationTick()).toMatchObject({ enabled: true, inspected: 1, observed: 1, errors: 0 });
  expect(m.find).toHaveBeenCalledWith(expect.objectContaining({ take: 3, where: expect.objectContaining({ workflowKind: "release_batch_observation_v1", currentStep: "observe_batches", cancelRequestedAt: null, status: { in: ["queued", "retrying", "running"] }, AND: expect.any(Array) }) }));
  expect(m.worker).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org", workflowRunId: "one", expectedVersion: 2, workerId: expect.stringMatching(/^batch-observer-/) }));
 });
 it("orders all eligible waits by last progress so new queued arrivals cannot starve an overdue retry", async () => {
  await runReleaseBatchObservationTick();
  expect(m.find.mock.calls[0][0].orderBy[0]).toEqual({ updatedAt: "asc" });
 });
 it("bounds work and isolates failed or stale claims without leaking provider diagnostics", async () => {
  m.find.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ id: String(i), organizationId: "org", version: 1 })));
  m.worker.mockRejectedValueOnce(new Error("private provider detail")).mockResolvedValueOnce({ observed: false });
  const result = await runReleaseBatchObservationTick(); expect(m.worker).toHaveBeenCalledTimes(3); expect(result).toMatchObject({ inspected: 3, errors: 1, observed: 1 }); expect(JSON.stringify(result)).not.toContain("private");
 });
});
