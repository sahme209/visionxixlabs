/**
 * DORA Metrics builder.
 *
 * The four canonical DevOps metrics every engineering leader reports
 * on (DORA = DevOps Research and Assessment):
 *
 *   1. Deployment Frequency — successful production deploys per day
 *   2. Lead Time for Changes — commit → production median (hours)
 *   3. Change Failure Rate — % of deploys that failed or were rolled back
 *   4. Mean Time to Recovery — incident triggered → resolved median (hours)
 *
 * Pure read-only composition. Derives from already-canonical signals
 * (GitHub Actions runs + Vercel deployments + Incident records). When
 * any source is in preview/blocked, the corresponding metric is
 * surfaced as `null` (NOT zero, NOT fabricated). The UI renders
 * null as "—" honestly.
 *
 * safetyContract literal 'cicd_ops_gated_no_unsafe_execution'.
 */

import "server-only";

import { buildCicdOps } from "./cicdOpsBuilder";
import { buildIncidentResponse } from "@/lib/incidents/incidentResponseBuilder";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type { PipelineRun } from "./cicdOpsModel";
import type { IncidentRecord } from "@/lib/incidents/incidentResponseModel";

// ---------------------------------------------------------------------------
// Typed contract
// ---------------------------------------------------------------------------

export type DoraTier =
  | "elite"   // Deploys ≥daily, lead <1hr, failure <15%, MTTR <1hr
  | "high"    // Deploys ≥weekly, lead <1d, failure <30%, MTTR <1d
  | "medium"  // Deploys ≥monthly, lead 1d-1mo, failure 0-30%, MTTR <1d
  | "low"     // Deploys <monthly, lead >1mo, failure >30%, MTTR >1d
  | "unknown";

export type DoraSourceMode = "live" | "partial_live" | "preview" | "blocked" | "unknown";

export interface DoraMetric<T> {
  /** Honest measurement — null when source data is missing/preview. */
  value: T | null;
  /** Where the number came from. */
  source: string;
  /** Number of samples that fed this metric. */
  sampleSize: number;
  /** Time window the metric covers. */
  windowDays: number;
  /** Honest preview/blocked when sample size is too small. */
  sourceMode: DoraSourceMode;
}

export interface DoraReport {
  generatedAt: string;
  tenantId?: string;
  /** 1. Deployment Frequency — successful deploys per day. */
  deploymentFrequency: DoraMetric<number>;
  /** 2. Lead Time for Changes — hours from commit to production. */
  leadTimeHours: DoraMetric<number>;
  /** 3. Change Failure Rate — fraction of deploys that failed. */
  changeFailureRate: DoraMetric<number>;
  /** 4. Mean Time to Recovery — incident triggered → resolved (hours). */
  meanTimeToRecoveryHours: DoraMetric<number>;
  /** Composite tier — only confidently set when ≥3 of 4 metrics live. */
  tier: DoraTier;
  /** Honest limitations. */
  limitations: string[];
  /** Hard literal contract. */
  safetyContract: "cicd_ops_gated_no_unsafe_execution";
  safeNextAction: { label: string; href: string };
}

export interface BuildDoraInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
  /** Lookback window in days. Defaults to 30. */
  windowDays?: number;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildDoraReport(input: BuildDoraInput): Promise<DoraReport> {
  const windowDays = input.windowDays ?? 30;
  const now = Date.now();
  const windowStart = now - windowDays * 86_400_000;

  const [cicd, incidents] = await Promise.all([
    buildCicdOps({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildIncidentResponse({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  // Pool all live pipeline runs across providers, filtered to the window.
  const allRuns: PipelineRun[] = cicd.providers
    .flatMap((p) => p.recentRuns)
    .filter((r) => new Date(r.startedAt).getTime() >= windowStart);
  const successfulProdRuns = allRuns.filter((r) => r.status === "success");
  const failedRuns = allRuns.filter((r) => r.status === "failed" || r.status === "timed_out");

  // 1. Deployment Frequency
  const deploymentFrequency: DoraMetric<number> = allRuns.length === 0
    ? nullMetric("github_actions+vercel.successful_runs", 0, windowDays, "preview")
    : {
        value: successfulProdRuns.length / windowDays,
        source: "github_actions+vercel.successful_runs",
        sampleSize: successfulProdRuns.length,
        windowDays,
        sourceMode: successfulProdRuns.length >= 10 ? "live" : "partial_live",
      };

  // 2. Lead Time for Changes — median pipeline run duration (proxy for
  //    commit → production when commit triggers deploy).
  const leadTimeHours: DoraMetric<number> = (() => {
    const durations = successfulProdRuns
      .map((r) => r.durationMs)
      .filter((d): d is number => typeof d === "number" && d > 0)
      .sort((a, b) => a - b);
    if (durations.length === 0) {
      return nullMetric("pipeline_run.duration_median", 0, windowDays, "preview");
    }
    const median = durations[Math.floor(durations.length / 2)];
    return {
      value: median / (1000 * 60 * 60),
      source: "pipeline_run.duration_median",
      sampleSize: durations.length,
      windowDays,
      sourceMode: durations.length >= 10 ? "live" : "partial_live",
    };
  })();

  // 3. Change Failure Rate
  const changeFailureRate: DoraMetric<number> = (() => {
    const denominator = successfulProdRuns.length + failedRuns.length;
    if (denominator === 0) return nullMetric("pipeline_run.failure_ratio", 0, windowDays, "preview");
    return {
      value: failedRuns.length / denominator,
      source: "pipeline_run.failure_ratio",
      sampleSize: denominator,
      windowDays,
      sourceMode: denominator >= 10 ? "live" : "partial_live",
    };
  })();

  // 4. MTTR — median incident triggered → resolved (hours)
  const meanTimeToRecoveryHours: DoraMetric<number> = (() => {
    const resolvedInWindow: IncidentRecord[] = incidents.incidents
      .filter((i) => i.resolvedAt && new Date(i.triggeredAt).getTime() >= windowStart)
      .filter((i) => i.status === "resolved" || i.status === "auto_resolved");
    const durations = resolvedInWindow
      .map((i) => new Date(i.resolvedAt!).getTime() - new Date(i.triggeredAt).getTime())
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    if (durations.length === 0) return nullMetric("incident.resolution_duration_median", 0, windowDays, "preview");
    const median = durations[Math.floor(durations.length / 2)];
    return {
      value: median / (1000 * 60 * 60),
      source: "incident.resolution_duration_median",
      sampleSize: durations.length,
      windowDays,
      sourceMode: durations.length >= 5 ? "live" : "partial_live",
    };
  })();

  // Composite tier — only set when ≥3 of 4 metrics live or partial_live
  const liveCount = [deploymentFrequency, leadTimeHours, changeFailureRate, meanTimeToRecoveryHours]
    .filter((m) => m.sourceMode === "live" || m.sourceMode === "partial_live").length;
  const tier: DoraTier = liveCount >= 3
    ? deriveTier(deploymentFrequency.value, leadTimeHours.value, changeFailureRate.value, meanTimeToRecoveryHours.value)
    : "unknown";

  const limitations: string[] = [];
  if (allRuns.length === 0) limitations.push("No pipeline runs in window — wire GitHub Actions or Vercel extractors.");
  if (incidents.incidents.length === 0) limitations.push("No incidents in window — wire PagerDuty / Opsgenie extractors for MTTR.");
  if (liveCount < 3) limitations.push("Tier classification requires ≥3 of 4 metrics live; some are still preview.");

  return {
    generatedAt: new Date().toISOString(),
    tenantId: String(input.tenantId),
    deploymentFrequency,
    leadTimeHours,
    changeFailureRate,
    meanTimeToRecoveryHours,
    tier,
    limitations,
    safetyContract: "cicd_ops_gated_no_unsafe_execution",
    safeNextAction: { label: "Open CI/CD Operations", href: "/dashboard/cicd" },
  };
}

// ---------------------------------------------------------------------------
// DORA tier classification (industry standard thresholds)
// ---------------------------------------------------------------------------

function deriveTier(
  freqPerDay: number | null,
  leadHrs: number | null,
  failureRate: number | null,
  mttrHrs: number | null,
): DoraTier {
  if (freqPerDay === null || leadHrs === null || failureRate === null || mttrHrs === null) {
    // Score based on whatever's present; need at least 3.
    const scores: number[] = [];
    if (freqPerDay !== null) scores.push(scoreFreq(freqPerDay));
    if (leadHrs !== null) scores.push(scoreLeadTime(leadHrs));
    if (failureRate !== null) scores.push(scoreFailureRate(failureRate));
    if (mttrHrs !== null) scores.push(scoreMttr(mttrHrs));
    if (scores.length < 3) return "unknown";
    return tierFromAvg(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  const avg = (scoreFreq(freqPerDay) + scoreLeadTime(leadHrs) + scoreFailureRate(failureRate) + scoreMttr(mttrHrs)) / 4;
  return tierFromAvg(avg);
}

// All score functions return 4=elite / 3=high / 2=medium / 1=low.
function scoreFreq(perDay: number): number {
  if (perDay >= 1) return 4;
  if (perDay >= 1 / 7) return 3;
  if (perDay >= 1 / 30) return 2;
  return 1;
}
function scoreLeadTime(hrs: number): number {
  if (hrs < 1) return 4;
  if (hrs < 24) return 3;
  if (hrs < 24 * 30) return 2;
  return 1;
}
function scoreFailureRate(rate: number): number {
  if (rate < 0.15) return 4;
  if (rate < 0.30) return 3;
  if (rate < 0.45) return 2;
  return 1;
}
function scoreMttr(hrs: number): number {
  if (hrs < 1) return 4;
  if (hrs < 24) return 3;
  if (hrs < 24 * 7) return 2;
  return 1;
}
function tierFromAvg(avg: number): DoraTier {
  if (avg >= 3.5) return "elite";
  if (avg >= 2.5) return "high";
  if (avg >= 1.5) return "medium";
  return "low";
}

function nullMetric(source: string, sampleSize: number, windowDays: number, sourceMode: DoraSourceMode): DoraMetric<number> {
  return { value: null, source, sampleSize, windowDays, sourceMode };
}
