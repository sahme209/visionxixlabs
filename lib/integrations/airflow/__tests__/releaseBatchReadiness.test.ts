import { beforeEach, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ load: vi.fn(), run: vi.fn(), request: vi.fn(), connection: vi.fn(), tasks: vi.fn() }));
vi.mock("../connection", () => ({ loadAirflowClient: io.load }));
import { readReleaseBatchDeclarations, readReleaseBatchReadiness, readReleaseBatchTasks } from "../releaseBatchReadiness";
import { isReleaseBatchReadiness } from "@/lib/desktop/releaseBatchReadinessContract";
const updatedAt = new Date("2026-10-24T00:00:00.000Z");
const dependency = { connectionId: "connection", connectionUpdatedAt: updatedAt.toISOString(), runs: [{ dagId: "daily", dagRunId: "selected", logicalDate: "2026-10-24T00:00:00.000001Z" }] };
const row = { id: "release", organizationId: "tenant", version: 3, status: "submitted", intakeJson: { airflowDependency: dependency } };
const repo = { tauriDeploymentRequest: { findFirst: io.request }, tenantIntegrationConnection: { findFirst: io.connection } };
const input = { organizationId: "tenant", requestId: "release", expectedVersion: 3 };
beforeEach(() => {
  vi.clearAllMocks(); io.request.mockResolvedValue(row); io.connection.mockResolvedValue({ id: "connection" });
  io.load.mockResolvedValue({ connectionId: "connection", connectionUpdatedAt: updatedAt, client: { getDagRun: io.run, listTaskInstances: io.tasks } });
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
it.each([
  {stored: {...row, version: 4}, reason: "changed"},
  {stored: {...row, version: 4, id: "other"}, reason: "unavailable"},
  {stored: {...row, version: 4, organizationId: "other"}, reason: "unavailable"},
])("returns $reason for a version mismatch without contacting Airflow", async ({stored, reason}) => {
  io.request.mockResolvedValue(stored);
  expect(await readReleaseBatchReadiness(repo, {...input, includeRuns: true})).toEqual({ready: false, reason});
  expect(io.load).not.toHaveBeenCalled();
  expect(io.run).not.toHaveBeenCalled();
});
it.each(["before", "during"])("reports closure %s observation only for the exact desktop release", async when => {
  const closed = {...row, status: "closed"};
  if (when === "during") io.request.mockResolvedValueOnce(row);
  io.request.mockResolvedValue(closed);
  expect(await readReleaseBatchReadiness(repo, {...input, includeRuns: true})).toEqual({
    ready: false, reason: "changed", closedRelease: {requestId: input.requestId, version: input.expectedVersion},
  });
  expect(io.load).toHaveBeenCalledTimes(when === "during" ? 1 : 0);
  expect(await readReleaseBatchReadiness(repo, input)).toEqual({ready:false, reason:"unavailable"});
});

it("validates a closure binding only for the exact desktop request without other evidence", () => {
  const closing = {ready:false, reason:"changed", closedRelease:{requestId:input.requestId, version:3}};
  expect(isReleaseBatchReadiness(closing, 3, input.requestId)).toBe(true);
  expect(isReleaseBatchReadiness(closing, 4, input.requestId)).toBe(false);
  expect(isReleaseBatchReadiness(closing, 3, "other")).toBe(false);
  expect(isReleaseBatchReadiness({...closing, ready:true, requestVersion:3}, 3, input.requestId)).toBe(false);
  expect(isReleaseBatchReadiness({...closing, observations:{}}, 3, input.requestId)).toBe(false);
  expect(isReleaseBatchReadiness({...closing, declarations:{}}, 3, input.requestId)).toBe(false);
});

it("rejects a changed connection before reading any run", async () => {
  io.load.mockResolvedValue({ connectionId: "other", connectionUpdatedAt: updatedAt, client: { getDagRun: io.run } });
  expect((await readReleaseBatchReadiness(repo, input)).ready).toBe(false); expect(io.run).not.toHaveBeenCalled();
});
it.each(["release", "connection"])("refuses success after concurrent %s changes", async changed => {
  if (changed === "release") io.request.mockResolvedValueOnce(row).mockResolvedValue({ ...row, version: 4 }); else io.connection.mockResolvedValue(null);
  expect((await readReleaseBatchReadiness(repo, input)).ready).toBe(false);
});
it.each(["release", "connection"])("does not report waiting after the %s changes during observation", async changed => {
  io.run.mockResolvedValue({...dependency.runs[0], state: "running"});
  if (changed === "release") io.request.mockResolvedValueOnce(row).mockResolvedValue({...row, version: 4});
  else io.connection.mockResolvedValue(null);
  expect(await readReleaseBatchReadiness(repo, input)).toEqual({ready: false, reason: "changed"});
});
it("reports waiting for an exact run only after rechecking the release and connection", async () => {
  io.run.mockResolvedValue({...dependency.runs[0], state: "queued"});
  expect(await readReleaseBatchReadiness(repo, input)).toEqual({ready: false, reason: "waiting"});
  expect(io.request).toHaveBeenCalledTimes(2);
  expect(io.connection).toHaveBeenCalledTimes(1);
});
it.each(["failed", "unknown", "wrong_run", "provider_failure"])("keeps %s distinct from a confirmed wait", async outcome => {
  if (outcome === "provider_failure") io.run.mockRejectedValue(new Error("private provider diagnostic"));
  else if (outcome === "wrong_run") io.run.mockResolvedValue({...dependency.runs[0], dagRunId: "other", state: "running"});
  else io.run.mockResolvedValue({...dependency.runs[0], state: outcome});
  expect(await readReleaseBatchReadiness(repo, input)).toEqual({ready: false, reason: "unavailable"});
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

it("lists each exact declared run only for the explicit display read", async () => {
  const [first] = dependency.runs;
  const second = { ...first, dagRunId: "next-declared" };
  io.request.mockResolvedValue({ ...row, intakeJson: { airflowDependency: { ...dependency, runs: [first, second] } } });
  io.run.mockImplementation(async (_dag, run) => ({ ...(run === first.dagRunId ? first : second), state: run === first.dagRunId ? "running" : "success" }));
  const result = await readReleaseBatchReadiness(repo, { ...input, includeRuns: true });
  expect(result).toEqual({ ready: false, reason: "waiting", observations: {
    requestId: "release", version: 3, runs: [
      { dagId: "daily", dagRunId: first.dagRunId, state: "running" },
      { dagId: "daily", dagRunId: second.dagRunId, state: "success" },
    ],
  } });
  io.run.mockClear();
  expect(await readReleaseBatchReadiness(repo, input)).toEqual({ ready: false, reason: "waiting" });
  expect(io.run).toHaveBeenCalledTimes(1);
});

it("withholds a partially observed set when an exact run changes", async () => {
  const [first] = dependency.runs;
  io.request.mockResolvedValue({ ...row, intakeJson: { airflowDependency: { ...dependency, runs: [first, { ...first, dagRunId: "second" }] } } });
  io.run.mockResolvedValue({ ...first, state: "success" });
  expect(await readReleaseBatchReadiness(repo, { ...input, includeRuns: true })).toEqual({ ready: false, reason: "unavailable" });
});

it("retains the old observation shape and projects timing only for an exact opted-in provider read", async () => {
  const startedAt = "2026-10-24T02:30:00+02:00";
  const endedAt = "2026-10-24T01:00:00Z";
  const run = { ...dependency.runs[0], state: "success", startedAt, endedAt };
  io.run.mockResolvedValue(run);
  const observation = { dagId: "daily", dagRunId: "selected", state: "success" };
  const expected = (runs: unknown[]) => ({ ready: true, requestVersion: 3, observations: { requestId: "release", version: 3, runs } });
  const include = { ...input, includeRuns: true, includeTiming: true };
  expect(await readReleaseBatchReadiness(repo, { ...input, includeRuns: true })).toEqual(expected([observation]));
  expect(await readReleaseBatchReadiness(repo, include)).toEqual(expected([{ ...observation, timing: { startedAt, endedAt } }]));
  io.run.mockResolvedValue({ ...run, endedAt: "2026-10-24T00:00:00Z" });
  expect(await readReleaseBatchReadiness(repo, include)).toEqual(expected([observation]));
  io.run.mockResolvedValue({ ...run, endedAt: "provider text" });
  expect(await readReleaseBatchReadiness(repo, include)).toEqual(expected([{ ...observation, timing: { startedAt, endedAt: null } }]));
  io.connection.mockResolvedValue(null);
  expect(await readReleaseBatchReadiness(repo, include)).toEqual({ ready: false, reason: "changed" });
});

it("reads a task page only for the declared run and verifies its logical date on both sides", async () => {
  const selection = { ...input, dagId: "daily", dagRunId: "selected", offset: 0 };
  const page = { tasks: [], totalEntries: 0, offset: 0 };
  io.tasks.mockResolvedValue(page);
  expect(await readReleaseBatchTasks(repo, { ...selection, dagRunId: "other" })).toBeUndefined();
  expect(io.run).not.toHaveBeenCalled();
  expect(io.tasks).not.toHaveBeenCalled();

  expect(await readReleaseBatchTasks(repo, selection)).toEqual({ ...page, requestId: "release", version: 3, dagId: "daily", dagRunId: "selected" });
  expect(io.run).toHaveBeenCalledTimes(2);
  expect(io.tasks).toHaveBeenCalledExactlyOnceWith("daily", "selected", 0, undefined);

  io.run.mockResolvedValueOnce({ ...dependency.runs[0], state: "success" })
    .mockResolvedValueOnce({ ...dependency.runs[0], state: "success", logicalDate: "2026-10-25T00:00:00Z" });
  expect(await readReleaseBatchTasks(repo, selection)).toBeUndefined();
  io.connection.mockResolvedValue(null);
  expect(await readReleaseBatchTasks(repo, selection)).toBeUndefined();
});

it("returns only saved identities without loading an Airflow credential or reading a provider", async () => {
  expect(await readReleaseBatchDeclarations(repo, input)).toEqual({
    requestId:"release",version:3,runs:[{dagId:"daily",dagRunId:"selected"}],
  });
  expect(io.request).toHaveBeenCalledExactlyOnceWith({where:{id:"release",organizationId:"tenant"}});
  expect(io.load).not.toHaveBeenCalled();
  expect(io.run).not.toHaveBeenCalled();
  for (const invalid of [{...row, version:4}, {...row, organizationId:"foreign"}, {...row, status:"draft"}]) {
    io.request.mockResolvedValue(invalid);
    expect(await readReleaseBatchDeclarations(repo, input)).toBeUndefined();
  }
});

it.each([
  {change: "changed state", transition: {state: "running", endedAt: null}},
  {change: "new attempt with the same state", transition: {startedAt: "2026-10-24T00:00:00.000002Z"}},
  {change: "changed end", transition: {endedAt: "2026-10-24T00:15:00Z"}},
])("withholds a task page after $change and allows a steady retry", async ({transition}) => {
  const before = {...dependency.runs[0], state: "failed", startedAt: "2026-10-24T00:00:00.000001Z", endedAt: "2026-10-24T00:10:00Z"};
  const after = {...before, ...transition};
  const selection = {...input, dagId: "daily", dagRunId: "selected", offset: 10};
  let resolveOldPage!: (page: unknown) => void;
  io.run.mockResolvedValue(before);
  io.tasks.mockImplementationOnce(() => new Promise(resolve => { resolveOldPage = resolve; }));
  const pending = readReleaseBatchTasks(repo, selection);
  await vi.waitFor(() => expect(io.tasks).toHaveBeenCalledTimes(1));
  io.run.mockResolvedValue(after);
  resolveOldPage({tasks: [{taskId: "old evidence"}], totalEntries: 11, offset: 10});

  expect(await pending).toBeUndefined();

  const page = {tasks: [{taskId: "current evidence"}], totalEntries: 11, offset: 10};
  io.tasks.mockResolvedValueOnce(page);
  expect(await readReleaseBatchTasks(repo, selection)).toEqual({...page, requestId: "release", version: 3, dagId: "daily", dagRunId: "selected"});
  expect(io.tasks.mock.calls).toEqual([["daily", "selected", 10, undefined], ["daily", "selected", 10, undefined]]);
});
