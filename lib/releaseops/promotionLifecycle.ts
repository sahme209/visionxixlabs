/**
 * Promotion lifecycles (pure, no I/O): derive, per repository, the order in
 * which releases move through environments from the enabled branch policies'
 * "promote from" requirements, and flag gaps a reviewer should know about.
 * Read-only: enforcement stays in the deployment policy guard.
 */
export interface LifecycleEnvironment { id: string; name: string; tier: string }
export interface LifecyclePolicy { repositoryId: string; repositoryName: string; environmentId: string; branchPattern: string; requirePromotionFromEnvironmentId: string | null; enabled: boolean }

export type LifecycleFinding =
  | { kind: "production_without_promotion"; environmentId: string }
  | { kind: "promotes_from_higher_tier"; fromEnvironmentId: string; toEnvironmentId: string }
  | { kind: "promotes_from_unknown_environment"; toEnvironmentId: string }
  | { kind: "cycle"; environmentIds: string[] };

export interface RepositoryLifecycle { repositoryId: string; repositoryName: string; phases: string[][]; findings: LifecycleFinding[] }

const TIER_RANK: Record<string, number> = { dev: 0, test: 1, qa: 2, uat: 3, stage: 4, preprod: 5, prod: 6 };
const rank = (tier: string) => TIER_RANK[tier] ?? 3;

export function buildLifecycles(environments: readonly LifecycleEnvironment[], policies: readonly LifecyclePolicy[]): RepositoryLifecycle[] {
  const envById = new Map(environments.map((e) => [e.id, e]));
  const byRepo = new Map<string, LifecyclePolicy[]>();
  for (const p of policies) if (p.enabled) { const list = byRepo.get(p.repositoryId) ?? []; list.push(p); byRepo.set(p.repositoryId, list); }
  const out: RepositoryLifecycle[] = [];
  for (const [repositoryId, list] of byRepo) {
    const findings: LifecycleFinding[] = [];
    const targets = new Set(list.map((p) => p.environmentId).filter((id) => envById.has(id)));
    const edges = new Map<string, Set<string>>(); // to -> from
    for (const p of list) {
      if (!envById.has(p.environmentId) || !p.requirePromotionFromEnvironmentId) continue;
      const from = p.requirePromotionFromEnvironmentId;
      if (!envById.has(from)) { findings.push({ kind: "promotes_from_unknown_environment", toEnvironmentId: p.environmentId }); continue; }
      (edges.get(p.environmentId) ?? edges.set(p.environmentId, new Set()).get(p.environmentId)!).add(from);
      if (rank(envById.get(from)!.tier) >= rank(envById.get(p.environmentId)!.tier)) findings.push({ kind: "promotes_from_higher_tier", fromEnvironmentId: from, toEnvironmentId: p.environmentId });
    }
    // Production targets where at least one enabled policy for that environment lacks a promotion requirement.
    for (const id of targets) {
      if (envById.get(id)!.tier !== "prod") continue;
      if (list.some((p) => p.environmentId === id && !p.requirePromotionFromEnvironmentId)) findings.push({ kind: "production_without_promotion", environmentId: id });
    }
    // Layered order (Kahn): phase n holds environments whose sources are all in earlier phases.
    const nodes = new Set<string>([...targets]);
    for (const [to, froms] of edges) { nodes.add(to); for (const f of froms) nodes.add(f); }
    const placed = new Set<string>(); const phases: string[][] = [];
    while (placed.size < nodes.size) {
      const layer = [...nodes].filter((n) => !placed.has(n) && [...(edges.get(n) ?? [])].every((f) => placed.has(f)));
      if (!layer.length) { findings.push({ kind: "cycle", environmentIds: [...nodes].filter((n) => !placed.has(n)).sort() }); break; }
      layer.sort((a, b) => rank(envById.get(a)!.tier) - rank(envById.get(b)!.tier) || envById.get(a)!.name.localeCompare(envById.get(b)!.name));
      phases.push(layer); layer.forEach((n) => placed.add(n));
    }
    out.push({ repositoryId, repositoryName: list[0].repositoryName, phases, findings });
  }
  return out.sort((a, b) => a.repositoryName.localeCompare(b.repositoryName));
}

export function describeFinding(f: LifecycleFinding, name: (id: string) => string): string {
  switch (f.kind) {
    case "production_without_promotion": return `${name(f.environmentId)} can receive a release that was never deployed to an earlier environment.`;
    case "promotes_from_higher_tier": return `${name(f.toEnvironmentId)} promotes from ${name(f.fromEnvironmentId)}, which is the same or a later stage.`;
    case "promotes_from_unknown_environment": return `${name(f.toEnvironmentId)} requires promotion from an environment that no longer exists, so deployments there are refused.`;
    case "cycle": return `${f.environmentIds.map(name).join(", ")} require promotion from each other, so none of them can be deployed first.`;
  }
}
