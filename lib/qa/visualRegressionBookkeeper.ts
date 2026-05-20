/**
 * Pure QA visual-regression bookkeeper.
 *
 * Folds per-screenshot diff results from a visual-regression run
 * (Playwright, Percy, Chromatic-shape inputs) into a typed verdict:
 *   - new: snapshot doesn't exist on the baseline
 *   - unchanged: pixel diff under threshold
 *   - changed: pixel diff above threshold
 *   - approved: previously-changed snapshot the operator has signed off
 *
 * Pure / deterministic. The actual diff math is the caller's job;
 * this module classifies and rolls up.
 */

export type SnapshotStatus = "new" | "unchanged" | "changed" | "approved";

export interface SnapshotDiff {
  /** Snapshot stable identifier (page + viewport + browser). */
  id: string;
  label: string;
  /** Pixel-diff ratio reported by the diff tool (0..1). */
  diffRatio: number;
  /** True iff there's no baseline for this snapshot. */
  isNew: boolean;
  /** True iff the operator approved a previous run with the same diff. */
  approvedFingerprint: string | null;
  /** This run's fingerprint of the changed pixels. */
  currentFingerprint: string;
}

export interface RegressionRow {
  id: string;
  label: string;
  status: SnapshotStatus;
  diffRatio: number;
  detail: string;
}

export interface RegressionReport {
  rows: RegressionRow[];
  totals: Record<SnapshotStatus, number>;
  /** Overall verdict: ok / warn / fail. */
  verdict: "ok" | "warn" | "fail";
  /** Approved-changed bypass count (operators acknowledged these). */
  approvedCount: number;
}

export interface RegressionOptions {
  /** Pixel-diff ratio above which a snapshot is flagged changed (default 0.001). */
  changedThreshold?: number;
  /** True if "new" snapshots should block the run (default false). */
  treatNewAsBlocking?: boolean;
}

function statusOf(d: SnapshotDiff, threshold: number): SnapshotStatus {
  if (d.isNew) return "new";
  if (d.approvedFingerprint && d.approvedFingerprint === d.currentFingerprint) return "approved";
  if (d.diffRatio >= threshold) return "changed";
  return "unchanged";
}

function detailOf(status: SnapshotStatus, d: SnapshotDiff): string {
  if (status === "new") return "no baseline yet";
  if (status === "unchanged") return `diff ${(d.diffRatio * 100).toFixed(3)}% within threshold`;
  if (status === "approved") return "operator-approved fingerprint";
  return `diff ${(d.diffRatio * 100).toFixed(3)}% — review needed`;
}

export function buildRegressionReport(
  diffs: readonly SnapshotDiff[],
  opts?: RegressionOptions,
): RegressionReport {
  const threshold = Math.max(0, opts?.changedThreshold ?? 0.001);
  const treatNewAsBlocking = Boolean(opts?.treatNewAsBlocking);

  const totals: Record<SnapshotStatus, number> = { new: 0, unchanged: 0, changed: 0, approved: 0 };
  const rows: RegressionRow[] = diffs.map((d) => {
    const status = statusOf(d, threshold);
    totals[status] += 1;
    return { id: d.id, label: d.label, status, diffRatio: d.diffRatio, detail: detailOf(status, d) };
  });

  rows.sort((a, b) => {
    const rank: Record<SnapshotStatus, number> = { changed: 0, new: 1, approved: 2, unchanged: 3 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.label < b.label ? -1 : 1;
  });

  const blocking = totals.changed + (treatNewAsBlocking ? totals.new : 0);
  const verdict: RegressionReport["verdict"] =
    blocking > 0 ? "fail"
    : totals.new > 0 ? "warn"
    : "ok";

  return { rows, totals, verdict, approvedCount: totals.approved };
}
