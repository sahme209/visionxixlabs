/**
 * Read-only "last recorded run" per saved task, across the three existing run
 * families. It reports what is recorded (family, stored status, last update)
 * and never infers success, health or an outcome that is not stored.
 */
export type SavedTaskRunFamily = "ai_task" | "readiness_run" | "pull_request_evidence";
export interface SavedTaskLastRun { taskId: string; taskVersion: number; family: SavedTaskRunFamily; status: string; recordedAt: Date }
export interface SavedTaskLastRunScope { organizationId: string; userId: string }
interface RunRow { taskId: string; taskVersion: number; status: string; updatedAt: Date }
interface RunTable {
  findMany(args: {
    where: { organizationId: string; createdByUserId: string; taskId: { in: string[] } };
    orderBy: Array<{ updatedAt: "desc" } | { id: "desc" }>;
    distinct: ["taskId"];
    take: number;
    select: { taskId: true; taskVersion: true; status: true; updatedAt: true };
  }): Promise<RunRow[]>;
}
export interface SavedTaskLastRunRepo { botAiTaskRun: RunTable; botTaskRun: RunTable; botPullRequestEvidenceRun: RunTable }
export const SAVED_TASK_LAST_RUN_MAX_IDS = 25;
const idPattern = /^bot_[a-f0-9]{64}$/;
const statusPattern = /^[a-z][a-z_]{0,63}$/;

export function parseSavedTaskIds(raw: string | null): string[] | null {
  if (raw === null || raw === "") return null;
  const ids = raw.split(",");
  if (ids.length > SAVED_TASK_LAST_RUN_MAX_IDS || new Set(ids).size !== ids.length || !ids.every(id => idPattern.test(id))) return null;
  return ids;
}

export async function listSavedTaskLastRuns(repo: SavedTaskLastRunRepo, scope: SavedTaskLastRunScope, ids: string[]): Promise<SavedTaskLastRun[]> {
  if (!scope.organizationId.trim() || !scope.userId.trim()) throw new Error("Verified workspace and actor are required.");
  if (ids.length === 0) return [];
  const args = {
    where: { organizationId: scope.organizationId, createdByUserId: scope.userId, taskId: { in: ids } },
    orderBy: [{ updatedAt: "desc" as const }, { id: "desc" as const }],
    distinct: ["taskId"] as ["taskId"],
    take: ids.length,
    select: { taskId: true as const, taskVersion: true as const, status: true as const, updatedAt: true as const },
  };
  const families: Array<[SavedTaskRunFamily, RunTable]> = [
    ["ai_task", repo.botAiTaskRun], ["readiness_run", repo.botTaskRun], ["pull_request_evidence", repo.botPullRequestEvidenceRun],
  ];
  const results = await Promise.all(families.map(async ([family, table]) => (await table.findMany(args)).map(row => ({ ...row, family }))));
  const latest = new Map<string, SavedTaskLastRun>();
  for (const row of results.flat()) {
    if (!ids.includes(row.taskId) || !Number.isInteger(row.taskVersion) || row.taskVersion < 0 || !statusPattern.test(row.status) || !(row.updatedAt instanceof Date) || Number.isNaN(row.updatedAt.getTime())) continue;
    const current = latest.get(row.taskId);
    if (!current || row.updatedAt.getTime() > current.recordedAt.getTime()) latest.set(row.taskId, { taskId: row.taskId, taskVersion: row.taskVersion, family: row.family, status: row.status, recordedAt: row.updatedAt });
  }
  return ids.flatMap(id => latest.get(id) ?? []);
}

interface RunPageTable {
  findMany(args: {
    where: { organizationId: string; createdByUserId: string; taskId: string };
    orderBy: Array<{ updatedAt: "desc" } | { id: "desc" }>;
    take: number;
    select: { taskId: true; taskVersion: true; status: true; updatedAt: true };
  }): Promise<RunRow[]>;
}
export interface SavedTaskRunHistoryRepo { botAiTaskRun: RunPageTable; botTaskRun: RunPageTable; botPullRequestEvidenceRun: RunPageTable }
export const SAVED_TASK_RUN_HISTORY_LIMIT = 20;

/** Most recent recorded runs for one saved task across the three families (read-only, newest first). */
export async function listSavedTaskRunHistory(repo: SavedTaskRunHistoryRepo, scope: SavedTaskLastRunScope, taskId: string): Promise<SavedTaskLastRun[]> {
  if (!scope.organizationId.trim() || !scope.userId.trim()) throw new Error("Verified workspace and actor are required.");
  if (!idPattern.test(taskId)) throw new Error("Invalid saved task.");
  const args = {
    where: { organizationId: scope.organizationId, createdByUserId: scope.userId, taskId },
    orderBy: [{ updatedAt: "desc" as const }, { id: "desc" as const }],
    take: SAVED_TASK_RUN_HISTORY_LIMIT,
    select: { taskId: true as const, taskVersion: true as const, status: true as const, updatedAt: true as const },
  };
  const families: Array<[SavedTaskRunFamily, RunPageTable]> = [
    ["ai_task", repo.botAiTaskRun], ["readiness_run", repo.botTaskRun], ["pull_request_evidence", repo.botPullRequestEvidenceRun],
  ];
  const rows = (await Promise.all(families.map(async ([family, table]) => (await table.findMany(args)).map(row => ({ ...row, family }))))).flat();
  return rows
    .filter(row => row.taskId === taskId && Number.isInteger(row.taskVersion) && row.taskVersion >= 0 && statusPattern.test(row.status) && row.updatedAt instanceof Date && !Number.isNaN(row.updatedAt.getTime()))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, SAVED_TASK_RUN_HISTORY_LIMIT)
    .map(row => ({ taskId: row.taskId, taskVersion: row.taskVersion, family: row.family, status: row.status, recordedAt: row.updatedAt }));
}
