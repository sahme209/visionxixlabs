/**
 * Service catalog (pure): one row per repository with its components and owners, guardrails, and the
 * latest recorded run in each environment. Built from recorded data only; nothing is inferred live.
 */
export interface CatalogRepository { id: string; fullName: string; defaultBranch: string; codeownersPresent: boolean; protectedBranches: string[] }
export interface CatalogComponent { repositoryId: string | null; name: string; ownerTeamLabel: string | null }
export interface CatalogExecution { repositoryFullName: string; environmentId: string; sourceCommitSha: string | null; status: string; conclusion: string | null; createdAt: Date }
export interface CatalogEnvironment { id: string; name: string; displayOrder: number }

export interface CatalogRow {
  repository: string;
  components: string[];
  owners: string[];
  guardrails: { codeowners: boolean; defaultBranchProtected: boolean };
  environments: Array<{ environmentId: string; commit: string | null; outcome: "succeeded" | "failed" | "in_progress" | "other"; at: string; /** Up to the last 10 outcomes here, oldest first. */ recent: Array<"succeeded" | "failed" | "in_progress" | "other"> } | null>;
  lastDeployedAt: string | null;
  recentFailureRate: number | null;
}

const outcomeOf = (e: CatalogExecution): "succeeded" | "failed" | "in_progress" | "other" =>
  e.status === "completed" ? (e.conclusion === "success" ? "succeeded" : e.conclusion === "failure" ? "failed" : "other") : ["queued", "in_progress", "reserved"].includes(e.status) ? "in_progress" : "other";

export function buildServiceCatalog(repos: readonly CatalogRepository[], components: readonly CatalogComponent[], executions: readonly CatalogExecution[], environments: readonly CatalogEnvironment[]): { environments: CatalogEnvironment[]; rows: CatalogRow[] } {
  const envs = [...environments].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  const rows = repos.map((r): CatalogRow => {
    const runs = executions.filter((e) => e.repositoryFullName === r.fullName).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const comps = components.filter((c) => c.repositoryId === r.id);
    const finished = runs.filter((e) => e.status === "completed").slice(0, 20);
    return {
      repository: r.fullName,
      components: comps.map((c) => c.name).sort(),
      owners: [...new Set(comps.map((c) => c.ownerTeamLabel).filter((o): o is string => Boolean(o)))].sort(),
      guardrails: { codeowners: r.codeownersPresent, defaultBranchProtected: r.protectedBranches.includes(r.defaultBranch) },
      environments: envs.map((env) => {
        const here = runs.filter((e) => e.environmentId === env.id);
        const latest = here[0];
        return latest ? { environmentId: env.id, commit: latest.sourceCommitSha ? latest.sourceCommitSha.slice(0, 7) : null, outcome: outcomeOf(latest), at: latest.createdAt.toISOString(), recent: here.slice(0, 10).reverse().map(outcomeOf) } : null;
      }),
      lastDeployedAt: runs[0]?.createdAt.toISOString() ?? null,
      recentFailureRate: finished.length ? Math.round((finished.filter((e) => e.conclusion !== "success").length / finished.length) * 100) : null,
    };
  }).sort((a, b) => a.repository.localeCompare(b.repository));
  return { environments: envs, rows };
}
