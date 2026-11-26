/**
 * Governed rollback to the last good version (parity: one-click rollback). Pure.
 *
 * From the recorded deployments of one repository to one environment, finds what to roll back to: the
 * most recent successful deployment of a different commit than the one currently deployed (or the last
 * success when the latest attempt failed). The rollback is an ordinary deployment of that version, so
 * policy, checks, rings, change windows and approvals all apply. A tag pins the commit; a branch may have
 * moved since, which readiness reveals by resolving the commit before anything is dispatched.
 */
export interface RecordedDeployment { id: string; environmentId: string; repositoryFullName: string; sourceRef: string | null; sourceKind: string | null; sourceCommitSha: string | null; status: string; conclusion: string | null; createdAt: string; configDigest?: string | null }
export type RollbackTarget =
  | { kind: "none"; reason: "no_deployments" | "no_earlier_success" }
  | { kind: "target"; from: RecordedDeployment; to: RecordedDeployment; pinned: boolean; note: string };

const succeeded = (d: RecordedDeployment) => d.status === "completed" && d.conclusion === "success" && Boolean(d.sourceCommitSha) && Boolean(d.sourceRef);

export function findRollbackTarget(deployments: readonly RecordedDeployment[], environmentId: string, repositoryFullName: string): RollbackTarget {
  const mine = deployments.filter((d) => d.environmentId === environmentId && d.repositoryFullName === repositoryFullName).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (!mine.length) return { kind: "none", reason: "no_deployments" };
  const latest = mine[0];
  const current = succeeded(latest) ? latest.sourceCommitSha : mine.find(succeeded)?.sourceCommitSha ?? null;
  const to = mine.find((d) => succeeded(d) && d.sourceCommitSha !== current && d !== latest) ?? (succeeded(latest) ? undefined : mine.find(succeeded));
  if (!to) return { kind: "none", reason: "no_earlier_success" };
  const pinned = to.sourceKind === "tag";
  const short = to.sourceCommitSha!.slice(0, 7);
  return { kind: "target", from: latest, to, pinned, note: pinned ? `Redeploys tag ${to.sourceRef} (${short}), which last deployed successfully here.` : `Redeploys branch ${to.sourceRef}. It deployed ${short} successfully here, but the branch may have moved since; readiness shows the commit it resolves to now.` };
}

/** After readiness resolves the commit, whether it is still the version being rolled back to. */
export function rollbackCommitMatches(target: RollbackTarget, resolvedCommit: string | null): boolean | null {
  if (target.kind !== "target" || !resolvedCommit) return null;
  return resolvedCommit.toLowerCase() === target.to.sourceCommitSha!.toLowerCase();
}
