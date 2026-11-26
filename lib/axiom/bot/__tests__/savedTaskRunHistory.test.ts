import { describe, expect, it, vi } from "vitest";
import { listSavedTaskRunHistory } from "../savedTaskLastRun";
const id = "bot_" + "a".repeat(64);
const scope = { organizationId: "org", userId: "user" };
const table = (rows: Array<{ taskId: string; taskVersion: number; status: string; updatedAt: Date }>) => ({ findMany: vi.fn().mockResolvedValue(rows) });
describe("saved task run history", () => {
  it("merges recorded runs from all families for one task, newest first, scoped to the actor", async () => {
    const repo = {
      botAiTaskRun: table([{ taskId: id, taskVersion: 1, status: "completed", updatedAt: new Date("2026-11-24T10:00:00Z") }]),
      botTaskRun: table([{ taskId: id, taskVersion: 2, status: "failed", updatedAt: new Date("2026-11-25T09:00:00Z") }]),
      botPullRequestEvidenceRun: table([{ taskId: id, taskVersion: 2, status: "running", updatedAt: new Date("2026-11-25T11:00:00Z") }]),
    };
    const runs = await listSavedTaskRunHistory(repo, scope, id);
    expect(runs.map(run => [run.family, run.status])).toEqual([["pull_request_evidence", "running"], ["readiness_run", "failed"], ["ai_task", "completed"]]);
    for (const t of Object.values(repo)) expect(t.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org", createdByUserId: "user", taskId: id }, take: 20 }));
  });
  it("drops rows for other tasks or with malformed values and refuses invalid ids", async () => {
    const repo = { botAiTaskRun: table([{ taskId: "bot_" + "b".repeat(64), taskVersion: 0, status: "completed", updatedAt: new Date() }, { taskId: id, taskVersion: 0, status: "Done!", updatedAt: new Date() }]), botTaskRun: table([]), botPullRequestEvidenceRun: table([]) };
    expect(await listSavedTaskRunHistory(repo, scope, id)).toEqual([]);
    await expect(listSavedTaskRunHistory(repo, scope, "../x")).rejects.toThrow();
  });
});
