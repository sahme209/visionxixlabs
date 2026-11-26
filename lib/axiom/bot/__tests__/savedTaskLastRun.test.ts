import { describe, expect, it, vi } from "vitest";
import { listSavedTaskLastRuns, parseSavedTaskIds, SAVED_TASK_LAST_RUN_MAX_IDS } from "../savedTaskLastRun";

const id = (c: string) => "bot_" + c.repeat(64);
const scope = { organizationId: "org", userId: "user" };
const table = (rows: Array<{ taskId: string; taskVersion: number; status: string; updatedAt: Date }>) => ({ findMany: vi.fn().mockResolvedValue(rows) });

describe("saved task last recorded run", () => {
  it("parses only a bounded list of unique saved task ids", () => {
    expect(parseSavedTaskIds(`${id("a")},${id("b")}`)).toEqual([id("a"), id("b")]);
    for (const raw of [null, "", "bot_x", `${id("a")},${id("a")}`, `${id("a")},`, Array.from({ length: SAVED_TASK_LAST_RUN_MAX_IDS + 1 }, (_, i) => "bot_" + i.toString(16).padStart(64, "0")).join(",")])
      expect(parseSavedTaskIds(raw)).toBeNull();
  });

  it("scopes every family to the workspace and actor and returns the latest recorded run per task", async () => {
    const repo = {
      botAiTaskRun: table([{ taskId: id("a"), taskVersion: 1, status: "completed", updatedAt: new Date("2026-11-25T10:00:00Z") }]),
      botTaskRun: table([{ taskId: id("a"), taskVersion: 2, status: "running", updatedAt: new Date("2026-11-25T11:00:00Z") }, { taskId: id("b"), taskVersion: 0, status: "failed", updatedAt: new Date("2026-11-24T09:00:00Z") }]),
      botPullRequestEvidenceRun: table([]),
    };
    const runs = await listSavedTaskLastRuns(repo, scope, [id("a"), id("b"), id("c")]);
    expect(runs).toEqual([
      { taskId: id("a"), taskVersion: 2, family: "readiness_run", status: "running", recordedAt: new Date("2026-11-25T11:00:00Z") },
      { taskId: id("b"), taskVersion: 0, family: "readiness_run", status: "failed", recordedAt: new Date("2026-11-24T09:00:00Z") },
    ]);
    for (const t of Object.values(repo)) expect(t.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org", createdByUserId: "user", taskId: { in: [id("a"), id("b"), id("c")] } }, distinct: ["taskId"], take: 3,
    }));
  });

  it("ignores rows for other tasks and malformed stored values instead of guessing", async () => {
    const repo = {
      botAiTaskRun: table([{ taskId: id("z"), taskVersion: 0, status: "completed", updatedAt: new Date() }, { taskId: id("a"), taskVersion: 0, status: "Completed!", updatedAt: new Date() }, { taskId: id("a"), taskVersion: -1, status: "queued", updatedAt: new Date() }]),
      botTaskRun: table([{ taskId: id("a"), taskVersion: 0, status: "queued", updatedAt: new Date("invalid") }]),
      botPullRequestEvidenceRun: table([]),
    };
    expect(await listSavedTaskLastRuns(repo, scope, [id("a")])).toEqual([]);
  });

  it("requires a verified scope and reads nothing for an empty list", async () => {
    const repo = { botAiTaskRun: table([]), botTaskRun: table([]), botPullRequestEvidenceRun: table([]) };
    await expect(listSavedTaskLastRuns(repo, { organizationId: " ", userId: "user" }, [id("a")])).rejects.toThrow();
    expect(await listSavedTaskLastRuns(repo, scope, [])).toEqual([]);
    expect(repo.botAiTaskRun.findMany).not.toHaveBeenCalled();
  });
});
