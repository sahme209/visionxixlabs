import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
const m = vi.hoisted(() => ({ claim: vi.fn(), checkpoint: vi.fn(), batches: vi.fn(), member: vi.fn(), release: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: m.member }, tauriDeploymentRequest: { findFirst: m.release } } }));
vi.mock("../releaseBatchObservationLease", () => ({ claimReleaseBatchObservation: m.claim }));
vi.mock("../releaseBatchObservationCheckpoint", async importOriginal => ({ ...await importOriginal<typeof import("../releaseBatchObservationCheckpoint")>(), checkpointReleaseBatchObservation: m.checkpoint }));
vi.mock("@/lib/integrations/airflow/releaseBatchReadiness", () => ({ readReleaseBatchReadiness: m.batches }));
vi.mock("@/lib/desktop/desktopCommercialAccess", () => ({ readDesktopCommercialAccess: m.access }));
import { runReleaseBatchObservation } from "../releaseBatchObservationWorker";
const now = new Date("2026-10-24T10:00:00Z");
const intake = { fixture: "read only" };
const binding = { requestId: "release", requestVersion: 2, intakeDigest: sha256ContentHash({ requestVersion: 2, intake }), startedAt: now.getTime(), deadlineAt: now.getTime() + 60000 };
const input = { organizationId: "org", workflowRunId: "wait", expectedVersion: 0, workerId: "reader" };
describe("read-only stored batch observation worker", () => {
 beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks();
  m.claim.mockResolvedValue({ id: "wait", organizationId: "org", version: 1, leaseExpiresAt: new Date(now.getTime() + 60000), requestedByUserId: "user", inputJson: binding });
  m.release.mockResolvedValue({ id: "release", organizationId: "org", version: 2, status: "submitted", intakeJson: intake });
  m.member.mockResolvedValue({ acceptedAt: now, role: "read_only" }); m.access.mockResolvedValue({ allowed: true }); m.batches.mockResolvedValue({ ready: true, requestVersion: 2 });
 });
 afterEach(() => vi.useRealTimers());
 it("reads only the stored release and checkpoints ready as an observation", async () => {
  await runReleaseBatchObservation(input);
  expect(m.batches).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "org", requestId: "release", expectedVersion: 2 }));
  expect(m.checkpoint).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 1, observation: "ready" }));
  expect(m.member).toHaveBeenCalledTimes(2);
 });
 it("does nothing when another worker owns the lease", async () => {
  m.claim.mockResolvedValue(null); await runReleaseBatchObservation(input); expect(m.member).not.toHaveBeenCalled(); expect(m.batches).not.toHaveBeenCalled(); expect(m.checkpoint).not.toHaveBeenCalled();
 });
 it("blocks removed membership and canceled billing before provider reads", async () => {
  m.member.mockResolvedValue(null); await runReleaseBatchObservation(input); expect(m.batches).not.toHaveBeenCalled();
  m.member.mockResolvedValue({ acceptedAt: now, role: "owner" }); m.access.mockResolvedValue({ allowed: false }); await runReleaseBatchObservation(input); expect(m.batches).not.toHaveBeenCalled();
 });
 it("does not trust a changed stored digest or response version", async () => {
  m.release.mockResolvedValue({ id: "release", organizationId: "org", version: 2, status: "submitted", intakeJson: {} });
  await runReleaseBatchObservation(input); expect(m.batches).not.toHaveBeenCalled();
 });
 it("rechecks permissions and release digest after a successful provider observation", async () => {
  m.member.mockResolvedValueOnce({ acceptedAt: now, role: "owner" }).mockResolvedValueOnce(null);
  await runReleaseBatchObservation(input); expect(m.checkpoint).toHaveBeenCalledWith(expect.objectContaining({ observation: "unavailable" }));
 });
 it("rejects wrong ready versions and digest changes during reads", async () => {
  m.batches.mockResolvedValue({ ready: true, requestVersion: 3 });
  await runReleaseBatchObservation(input); expect(m.checkpoint).toHaveBeenLastCalledWith(expect.objectContaining({ observation: "changed" }));
  m.release.mockResolvedValueOnce({ id: "release", organizationId: "org", version: 2, status: "submitted", intakeJson: intake }).mockResolvedValueOnce({ id: "release", organizationId: "org", version: 3, status: "submitted", intakeJson: intake });
  m.batches.mockResolvedValue({ ready: true, requestVersion: 2 }); await runReleaseBatchObservation(input);
  expect(m.checkpoint).toHaveBeenLastCalledWith(expect.objectContaining({ observation: "changed" }));
 });
 it("fails closed on provider errors and does not expose diagnostics", async () => {
  m.batches.mockRejectedValue(new Error("private provider diagnostic")); await runReleaseBatchObservation(input);
  expect(m.checkpoint).toHaveBeenLastCalledWith(expect.objectContaining({ observation: "unavailable" }));
 });
 it("refuses a mismatched claimed identity without provider reads", async () => {
  m.claim.mockResolvedValue({ id: "other", organizationId: "org", version: 1 });
  await expect(runReleaseBatchObservation(input)).rejects.toThrow(); expect(m.batches).not.toHaveBeenCalled();
 });
 it("ends a slow observation within the lease and aborts its provider signal", async () => {
  m.batches.mockImplementation(() => new Promise(() => {}));
  const pending = runReleaseBatchObservation(input);
  await vi.advanceTimersByTimeAsync(45_000);
  expect(m.checkpoint).toHaveBeenCalledWith(expect.objectContaining({ observation: "unavailable", now: new Date(now.getTime() + 45_000) }));
  expect(m.batches.mock.calls[0][1].signal.aborted).toBe(true);
  await pending;
 });
 it("skips provider reads after the immutable deadline", async () => {
  vi.setSystemTime(new Date(binding.deadlineAt)); await runReleaseBatchObservation(input); expect(m.batches).not.toHaveBeenCalled();
 });
});
