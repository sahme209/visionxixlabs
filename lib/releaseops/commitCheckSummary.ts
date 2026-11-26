/** Per-commit summary of blocking check results (pure): how many passed, failed or have no result. */
export interface SummaryResult { checkKey: string; releaseRef: string | null; status: string; reportedAt: Date }
export interface CommitCheckSummary { total: number; passed: number; failed: number; missing: number }

export function summarizeCommitChecks(commits: readonly string[], blockingKeys: readonly string[], results: readonly SummaryResult[]): Record<string, CommitCheckSummary> {
  const latest = new Map<string, SummaryResult>();
  for (const r of results) {
    if (!r.releaseRef) continue;
    const id = `${r.releaseRef}\u0000${r.checkKey}`;
    const prev = latest.get(id);
    if (!prev || r.reportedAt > prev.reportedAt) latest.set(id, r);
  }
  const out: Record<string, CommitCheckSummary> = {};
  for (const sha of commits) {
    const s: CommitCheckSummary = { total: blockingKeys.length, passed: 0, failed: 0, missing: 0 };
    for (const k of blockingKeys) {
      const r = latest.get(`${sha}\u0000${k}`);
      if (!r) s.missing += 1; else if (r.status === "passed") s.passed += 1; else s.failed += 1;
    }
    out[sha] = s;
  }
  return out;
}
