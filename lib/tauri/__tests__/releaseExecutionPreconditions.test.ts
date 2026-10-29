import { beforeEach, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ batch: vi.fn(), source: vi.fn(), request: vi.fn(), connection: vi.fn() }));
vi.mock("@/lib/integrations/airflow/releaseBatchReadiness", () => ({ readReleaseBatchReadiness: io.batch }));
vi.mock("../intakeWorkflowSource", () => ({ verifyIntakeWorkflowSource: io.source }));
import { verifyReleaseExecutionPreconditions } from "../releaseExecutionPreconditions";
import { completeReleaseIntake } from "./fixtures/completeReleaseIntake";
import { sha256ContentHash } from "../contentHash";
const intake = { ...completeReleaseIntake(), repositoryUrls: ["https://github.com/team/service"], sourceBranch: "main", workflowName: "release.yml", workflowSource: { repositoryFullName: "team/service", ref: "main", path: ".github/workflows/release.yml", blobSha: "a".repeat(40) } };
const row = { id: intake.id, organizationId: intake.tenantId, version: 3, status: "submitted", intakeJson: intake };
const digest = sha256ContentHash({ requestVersion: row.version, intake: row.intakeJson });
const repo = { tauriDeploymentRequest: { findFirst: io.request }, tenantIntegrationConnection: { findFirst: io.connection } };
const input = { organizationId: row.organizationId, requestId: row.id, expectedVersion: 3, expectedDigest: digest, kind: "dispatch_workflow" as const, signal: new AbortController().signal };
beforeEach(() => { vi.clearAllMocks(); io.request.mockResolvedValue(row); io.source.mockResolvedValue(true); io.batch.mockResolvedValue({ ready: true, requestVersion: 3 }); io.connection.mockResolvedValue({id:"connection"}); });
it("binds complete stored intake and source but does not grant execution approval", async () => {
  expect(await verifyReleaseExecutionPreconditions(repo, input)).toEqual({ ready: true, requestVersion: 3, digest });
  expect(io.source).toHaveBeenCalledWith(row.organizationId, expect.objectContaining({ workflowSource: intake.workflowSource }), input.signal);
  expect(io.request).toHaveBeenCalledTimes(2); expect(io.batch).not.toHaveBeenCalled();
});
it.each([{ expectedVersion: 4 }, { expectedDigest: "b".repeat(64) }, { kind: "publish_release" }])("rejects stale or unsupported execution intent before provider reads", async patch => {
  expect((await verifyReleaseExecutionPreconditions(repo, { ...input, ...patch } as typeof input)).ready).toBe(false); expect(io.source).not.toHaveBeenCalled(); expect(io.batch).not.toHaveBeenCalled();
});
it("blocks source-unverified dispatch and a changed request after remote reads", async () => {
  io.source.mockResolvedValue(false); expect((await verifyReleaseExecutionPreconditions(repo, input)).ready).toBe(false);
  io.source.mockResolvedValue(true); io.request.mockResolvedValueOnce(row).mockResolvedValue({ ...row, version: 4 });
  expect((await verifyReleaseExecutionPreconditions(repo, input)).ready).toBe(false);
});
it("does not treat an absent workflow observation as authorization for automatic dispatch", async () => {
  const stored = { ...row, intakeJson: completeReleaseIntake() }; io.request.mockResolvedValue(stored);
  expect((await verifyReleaseExecutionPreconditions(repo, { ...input, expectedDigest: sha256ContentHash({ requestVersion: 3, intake: stored.intakeJson }) })).ready).toBe(false);
});
it("holds a selected release for incomplete exact batches without treating this as source approval", async () => {
  const stored = { ...row, intakeJson: { ...intake, airflowDependency: { connectionId: "connection", connectionUpdatedAt: "2026-10-24T00:00:00.000Z", runs: [{ dagId: "daily", dagRunId: "selected", logicalDate: "2026-10-24T00:00:00Z" }] } } };
  io.request.mockResolvedValue(stored); io.batch.mockResolvedValue({ ready: false, reason: "waiting" });
  expect(await verifyReleaseExecutionPreconditions(repo, { ...input, expectedDigest: sha256ContentHash({ requestVersion: 3, intake: stored.intakeJson }) })).toEqual({ ready: false, reason: "waiting" });
  expect(io.source).not.toHaveBeenCalled();
});
it("does not return a preflight proof after caller cancellation during remote reads", async () => {
  const controller = new AbortController(); io.source.mockImplementation(async () => { controller.abort(); return true; });
  expect((await verifyReleaseExecutionPreconditions(repo, { ...input, signal: controller.signal })).ready).toBe(false);
});

it("rejects a selected connection revoked during later GitHub verification",async()=>{
 const airflowDependency={connectionId:'connection',connectionUpdatedAt:'2026-10-24T00:00:00.000Z',runs:[{dagId:'daily',dagRunId:'selected',logicalDate:'2026-10-24T00:00:00Z'}]};
 const stored={...row,intakeJson:{...intake,airflowDependency}};io.request.mockResolvedValue(stored);
 let resolve!:(value:boolean)=>void;io.source.mockReturnValue(new Promise(r=>resolve=r));
 const pending=verifyReleaseExecutionPreconditions(repo,{...input,expectedDigest:sha256ContentHash({requestVersion:3,intake:stored.intakeJson})});
 await vi.waitFor(()=>expect(io.source).toHaveBeenCalled());io.connection.mockResolvedValue(null);resolve(true);
 expect((await pending).ready).toBe(false);
});

it('propagates caller cancellation through the exact batch read before source verification',async()=>{
 const airflowDependency={connectionId:'connection',connectionUpdatedAt:'2026-10-24T00:00:00.000Z',runs:[{dagId:'daily',dagRunId:'selected',logicalDate:'2026-10-24T00:00:00Z'}]};
 const stored={...row,intakeJson:{...intake,airflowDependency}};
 io.request.mockResolvedValue(stored);
 const controller=new AbortController();
 io.batch.mockImplementationOnce(async(_repo,args)=>{
   expect(args.signal).toBe(controller.signal);
   controller.abort();
   return {ready:true,requestVersion:3};
 });
 expect((await verifyReleaseExecutionPreconditions(repo,{...input,signal:controller.signal,expectedDigest:sha256ContentHash({requestVersion:3,intake:stored.intakeJson})})).ready).toBe(false);
 expect(io.batch).toHaveBeenCalledWith(repo,expect.objectContaining({signal:controller.signal}));
 expect(io.source).not.toHaveBeenCalled();
});
