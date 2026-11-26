/** Octopus-style environment board from recorded workflow runs: one row per repository, one column per environment. */
export interface BoardEnvironment { id: string; name: string; tier: string; displayOrder: number }
export interface BoardExecution { id: string; environmentId: string; repositoryFullName: string; sourceRef: string | null; sourceCommitSha: string | null; status: string; conclusion: string | null; createdAt: string; completedAt: string | null }
export interface BoardCell { executionId: string; ref: string | null; commit: string | null; status: string; conclusion: string | null; at: string }
export interface EnvironmentBoard { environments: BoardEnvironment[]; rows: Array<{ repository: string; cells: Array<BoardCell | null> }>; unplaced: number }

export function buildEnvironmentBoard(environments: readonly BoardEnvironment[], executions: readonly BoardExecution[]): EnvironmentBoard {
  const columns = [...environments].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  const index = new Map(columns.map((env, i) => [env.id, i]));
  const latest = new Map<string, BoardExecution>();
  let unplaced = 0;
  for (const run of executions) {
    if (!index.has(run.environmentId)) { unplaced += 1; continue; }
    if (!Number.isFinite(Date.parse(run.createdAt))) continue;
    const key = JSON.stringify([run.repositoryFullName, run.environmentId]);
    const current = latest.get(key);
    if (!current || Date.parse(run.createdAt) > Date.parse(current.createdAt)) latest.set(key, run);
  }
  const repositories = [...new Set([...latest.values()].map((run) => run.repositoryFullName))].sort();
  const rows = repositories.map((repository) => ({
    repository,
    cells: columns.map((env) => {
      const run = latest.get(JSON.stringify([repository, env.id]));
      return run ? { executionId: run.id, ref: run.sourceRef, commit: run.sourceCommitSha ? run.sourceCommitSha.slice(0, 7) : null, status: run.status, conclusion: run.conclusion, at: run.completedAt ?? run.createdAt } : null;
    }),
  }));
  return { environments: columns, rows, unplaced };
}
