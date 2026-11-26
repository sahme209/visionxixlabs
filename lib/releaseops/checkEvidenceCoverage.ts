/**
 * How many recorded deployments had passing evidence for every currently blocking check (pure).
 * Uses today's blocking set, so older deployments may predate a check; the page says so.
 */
export interface CoverageResult { checkKey: string; releaseRef: string | null; status: string }
export interface CheckEvidenceCoverage { deployments: number; allPassed: number; anyFailed: number; missing: number }

export function checkEvidenceCoverage(commitShas: readonly (string | null)[], blockingKeys: readonly string[], results: readonly CoverageResult[]): CheckEvidenceCoverage {
  const out: CheckEvidenceCoverage = { deployments: 0, allPassed: 0, anyFailed: 0, missing: 0 };
  const byCommit = new Map<string, Map<string, Set<string>>>();
  for (const r of results) {
    if (!r.releaseRef) continue;
    const keys = byCommit.get(r.releaseRef) ?? new Map<string, Set<string>>();
    (keys.get(r.checkKey) ?? keys.set(r.checkKey, new Set()).get(r.checkKey)!).add(r.status);
    byCommit.set(r.releaseRef, keys);
  }
  for (const sha of commitShas) {
    out.deployments += 1;
    const keys = sha ? byCommit.get(sha) : undefined;
    if (blockingKeys.some((k) => keys?.get(k)?.has("failed") || keys?.get(k)?.has("error"))) out.anyFailed += 1;
    else if (blockingKeys.every((k) => keys?.get(k)?.has("passed"))) out.allPassed += 1;
    else out.missing += 1;
  }
  return out;
}
