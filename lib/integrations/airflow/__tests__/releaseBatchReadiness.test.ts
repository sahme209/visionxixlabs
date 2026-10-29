import { beforeEach, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ load: vi.fn(), run: vi.fn(), request: vi.fn(), connection: vi.fn() }));
vi.mock("../connection", () => ({ loadAirflowClient: io.load }));
import { readReleaseBatchReadiness } from "../releaseBatchReadiness";
const updatedAt = new Date("2026-10-24T00:00:00.000Z");
const dependency = { connectionId: "connection", connectionUpdatedAt: updatedAt.toISOString(), runs: [{ dagId: "daily", dagRunId: "selected", logicalDate: "2026-10-24T00:00:00.000001Z" }] };
const row = { id: "release", organizationId: "tenant", version: 3, status: "submitted", intakeJson: { airflowDependency: dependency } };
const repo = { tauriDeploymentRequest: { findFirst: io.request }, tenantIntegrationConnection: { findFirst: io.connection } };
const input = { organizationId: "tenant", requestId: "release", expectedVersion: 3 };
beforeEach(() => {
  vi.clearAllMocks(); io.request.mockResolvedValue(row); io.connection.mockResolvedValue({ id: "connection" });
  io.load.mockResolvedValue({ connectionId: "connection", connectionUpdatedAt: updatedAt, client: { getDagRun: io.run } });
  io.run.mockResolvedValue({ ...dependency.runs[0], state: "success" });
});
it("fences the exact stored release and active tenant connection around exact batch reads", async () => {
  expect(await readReleaseBatchReadiness(repo, input)).toEqual({ ready: true, requestVersion: 3 });
  expect(io.load).toHaveBeenCalledWith("tenant"); expect(io.run).toHaveBeenCalledWith("daily", "selected");
  expect(io.connection).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "tenant", id: "connection", status: "active", updatedAt }) }));
  expect(io.request).toHaveBeenCalledTimes(2);
});
it.each([null, { ...row, version: 4 }, { ...row, status: "draft" }, { ...row, intakeJson: {} }])("does not contact Airflow for missing or stale stored specifications", async stored => {
  io.request.mockResolvedValue(stored); expect((await readReleaseBatchReadiness(repo, input)).ready).toBe(false); expect(io.load).not.toHaveBeenCalled();
});
it("rejects a changed connection before reading any run", async () => {
  io.load.mockResolvedValue({ connectionId: "other", connectionUpdatedAt: updatedAt, client: { getDagRun: io.run } });
  expect((await readReleaseBatchReadiness(repo, input)).ready).toBe(false); expect(io.run).not.toHaveBeenCalled();
});
it.each(["release", "connection"])("refuses success after concurrent %s changes", async changed => {
  if (changed === "release") io.request.mockResolvedValueOnce(row).mockResolvedValue({ ...row, version: 4 }); else io.connection.mockResolvedValue(null);
  expect((await readReleaseBatchReadiness(repo, input)).ready).toBe(false);
});
it("returns unavailable without exposing provider diagnostics", async () => {
  io.load.mockRejectedValue(new Error("private credential diagnostic")); expect(await readReleaseBatchReadiness(repo, input)).toEqual({ ready: false, reason: "unavailable" });
});
it("rejects same-version intake changes and foreign tenant rows", async () => {
  io.request.mockResolvedValueOnce(row).mockResolvedValue({ ...row, intakeJson: { ...row.intakeJson, changed: true } });
  expect(await readReleaseBatchReadiness(repo, input)).toEqual({ ready: false, reason: "changed" });
  vi.clearAllMocks(); io.request.mockResolvedValue({ ...row, organizationId: "foreign" });
  expect((await readReleaseBatchReadiness(repo, input)).ready).toBe(false); expect(io.load).not.toHaveBeenCalled();
});
it("does not use an old connection revision or call a provider for a bad expected version", async () => {
  io.load.mockResolvedValue({ connectionId: "connection", connectionUpdatedAt: new Date(updatedAt.getTime() + 1), client: { getDagRun: io.run } });
  expect(await readReleaseBatchReadiness(repo, input)).toEqual({ ready: false, reason: "changed" }); expect(io.run).not.toHaveBeenCalled();
  vi.clearAllMocks(); expect((await readReleaseBatchReadiness(repo, { ...input, expectedVersion: 0 })).ready).toBe(false); expect(io.request).not.toHaveBeenCalled();
});

it.each(['rejected','failed','completed','unknown_legacy'])('does not report release readiness for unsupported status %s',async status=>{
 io.request.mockResolvedValue({...row,status});expect((await readReleaseBatchReadiness(repo,input)).ready).toBe(false);expect(io.load).not.toHaveBeenCalled();
});
