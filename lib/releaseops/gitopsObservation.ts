/**
 * GitOps observation kernel (parity item 10). Pure: compares what V19 recorded as the last deployed
 * commit for an environment with what a GitOps controller (Argo CD or Flux) reports it has applied.
 * Read-only by design: V19 never syncs, reconciles or suspends; it only explains the difference.
 */

export type GitopsController = "argocd" | "flux";
export interface GitopsObserved {
  controller: GitopsController;
  name: string;
  /** Commit the controller reports as applied; null when it did not report one we can trust. */
  appliedCommit: string | null;
  /** Controller's own view: Synced/Ready vs OutOfSync/NotReady. */
  healthy: boolean | null;
  suspended?: boolean;
}
export type GitopsVerdict =
  | { state: "matches"; detail: string }
  | { state: "controller_behind"; detail: string }
  | { state: "controller_differs"; detail: string }
  | { state: "controller_unhealthy"; detail: string }
  | { state: "suspended"; detail: string }
  | { state: "unknown"; detail: string };

const SHA = /^[0-9a-f]{7,64}$/;

/** "main@sha1:abc…", "sha1:abc…" or a bare SHA → lowercase hex, else null. */
export function commitFromRevision(revision: string | null | undefined): string | null {
  if (!revision) return null;
  const hex = revision.slice(revision.lastIndexOf(":") + 1).toLowerCase();
  return SHA.test(hex) ? hex : null;
}

const same = (a: string, b: string) => (a.length <= b.length ? b.startsWith(a) : a.startsWith(b));

export function compareGitops(recordedCommit: string | null, observed: GitopsObserved, recordedHistory: readonly string[] = []): GitopsVerdict {
  const label = observed.controller === "argocd" ? "Argo CD" : "Flux";
  if (observed.suspended) return { state: "suspended", detail: `${label} reconciliation of ${observed.name} is suspended, so the cluster may not follow new commits.` };
  const applied = observed.appliedCommit?.toLowerCase() ?? null;
  const recorded = recordedCommit?.toLowerCase() ?? null;
  if (!applied || !recorded || !SHA.test(applied) || !SHA.test(recorded)) return { state: "unknown", detail: `${label} or V19 has no trustworthy commit for ${observed.name}; nothing is inferred.` };
  if (same(applied, recorded)) {
    if (observed.healthy === false) return { state: "controller_unhealthy", detail: `${label} applied the recorded commit ${recorded.slice(0, 7)} but reports ${observed.name} as not healthy.` };
    return { state: "matches", detail: `${label} applied the same commit V19 recorded (${recorded.slice(0, 7)}).` };
  }
  if (recordedHistory.some((c) => SHA.test(c.toLowerCase()) && same(c.toLowerCase(), applied))) {
    return { state: "controller_behind", detail: `${label} still runs ${applied.slice(0, 7)}, an earlier V19 deployment; ${recorded.slice(0, 7)} has not been applied yet.` };
  }
  return { state: "controller_differs", detail: `${label} applied ${applied.slice(0, 7)}, which V19 has no record of deploying to this environment. Review changes made outside V19.` };
}
