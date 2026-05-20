/**
 * Pure GitHub PR risk scorer.
 *
 * Given a PR's metadata (LOC changed, files touched, infra vs. app
 * file mix, CI green/red, # approvals, time since last merge to that
 * area), compute a 0..100 risk score + verdict.
 *
 * Pure / deterministic. No DB. No GitHub API.
 */

export interface PrSignals {
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  infraFilesChanged: number;      // tf/k8s/dockerfiles
  ciGreen: boolean;
  approvals: number;
  /** Days since last merge to this code area (proxy for context drift). */
  daysSinceLastMergeInArea: number;
  /** True if PR title/body indicates a hotfix. */
  isHotfix: boolean;
}

export interface PrRiskReport {
  score: number;              // 0..100, higher = riskier
  verdict: "low" | "medium" | "high" | "critical";
  contributions: Array<{ factor: string; delta: number; note: string }>;
}

const clampScore = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export function scorePrRisk(signals: PrSignals): PrRiskReport {
  let score = 0;
  const contributions: PrRiskReport["contributions"] = [];

  const totalLoc = signals.linesAdded + signals.linesDeleted;
  if (totalLoc > 1000) {
    score += 30;
    contributions.push({ factor: "large_loc", delta: 30, note: `${totalLoc} lines touched` });
  } else if (totalLoc > 400) {
    score += 18;
    contributions.push({ factor: "medium_loc", delta: 18, note: `${totalLoc} lines touched` });
  } else if (totalLoc > 100) {
    score += 8;
    contributions.push({ factor: "small_loc", delta: 8, note: `${totalLoc} lines touched` });
  }

  if (signals.filesChanged > 30) {
    score += 12;
    contributions.push({ factor: "many_files", delta: 12, note: `${signals.filesChanged} files` });
  }

  if (signals.infraFilesChanged > 0) {
    const delta = Math.min(20, signals.infraFilesChanged * 4);
    score += delta;
    contributions.push({ factor: "infra_touched", delta, note: `${signals.infraFilesChanged} infra file(s)` });
  }

  if (!signals.ciGreen) {
    score += 25;
    contributions.push({ factor: "ci_red", delta: 25, note: "CI is not green" });
  }

  if (signals.approvals === 0) {
    score += 15;
    contributions.push({ factor: "no_approvals", delta: 15, note: "0 approvals" });
  } else if (signals.approvals === 1 && signals.infraFilesChanged > 0) {
    score += 5;
    contributions.push({ factor: "single_approval_with_infra", delta: 5, note: "infra change with 1 approval" });
  }

  if (signals.daysSinceLastMergeInArea >= 30) {
    score += 8;
    contributions.push({ factor: "stale_area", delta: 8, note: `${signals.daysSinceLastMergeInArea}d since last merge in this area` });
  }

  if (signals.isHotfix) {
    score += 10;
    contributions.push({ factor: "hotfix", delta: 10, note: "hotfix PR — extra eyes please" });
  }

  const clamped = clampScore(score);
  const verdict: PrRiskReport["verdict"] =
    clamped >= 70 ? "critical"
    : clamped >= 45 ? "high"
    : clamped >= 20 ? "medium"
    : "low";

  return { score: clamped, verdict, contributions };
}
