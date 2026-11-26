/**
 * Ring gate (pure + IO boundary). An environment tagged ring:N (N > 0) may only deploy a commit of a
 * repository after at least one environment tagged ring:N-1 completed a successful deployment of the
 * same repository and commit. Untagged environments and ring 0 are not gated. Fails closed on read errors.
 */
export function ringOf(tags: readonly string[]): number | null {
  const t = tags.find((x) => x.startsWith("ring:"));
  const n = t ? Number(t.slice(5)) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export type RingGate = { ok: true; ring: number | null } | { ok: false; ring: number; previousRing: number; reason: "no_previous_ring_environment" | "previous_ring_not_deployed" };

export interface RingGateRepo {
  environment: {
    findFirst(args: { where: { id: string; organizationId: string }; select: { tags: true } }): Promise<{ tags: string[] } | null>;
    findMany(args: { where: { organizationId: string; tags: { has: string } }; select: { id: true } }): Promise<Array<{ id: string }>>;
  };
  deploymentExecution: {
    count(args: { where: { organizationId: string; environmentId: { in: string[] }; repositoryFullName: string; sourceCommitSha: string; status: "completed"; conclusion: "success" } }): Promise<number>;
  };
}

export async function readRingGate(repo: RingGateRepo, input: { organizationId: string; environmentId: string; repositoryFullName: string; commitSha: string }): Promise<RingGate | "unavailable"> {
  try {
    const env = await repo.environment.findFirst({ where: { id: input.environmentId, organizationId: input.organizationId }, select: { tags: true } });
    const ring = env ? ringOf(env.tags ?? []) : null;
    if (ring === null || ring === 0) return { ok: true, ring };
    const previous = await repo.environment.findMany({ where: { organizationId: input.organizationId, tags: { has: `ring:${ring - 1}` } }, select: { id: true } });
    if (previous.length === 0) return { ok: false, ring, previousRing: ring - 1, reason: "no_previous_ring_environment" };
    const done = await repo.deploymentExecution.count({ where: { organizationId: input.organizationId, environmentId: { in: previous.map((p) => p.id) }, repositoryFullName: input.repositoryFullName, sourceCommitSha: input.commitSha, status: "completed", conclusion: "success" } });
    return done > 0 ? { ok: true, ring } : { ok: false, ring, previousRing: ring - 1, reason: "previous_ring_not_deployed" };
  } catch {
    return "unavailable";
  }
}
