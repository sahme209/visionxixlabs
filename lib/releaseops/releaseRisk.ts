/**
 * Release risk model — pure function over typed inputs.
 *
 * Composes readiness score, deployment blockers, blast radius, environment,
 * and recent-failure signal into a single risk read. The reasoner consumes
 * this and so does the ReleaseOps UI — both keep the same math.
 */

import type { EnvironmentName, Release, ServiceReadiness } from "./releaseModel";
import type { DeploymentBlocker, BlockerSeverity } from "./deploymentBlockers";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export type ReleaseRiskLevel = "minimal" | "low" | "moderate" | "elevated" | "critical";

export interface ReleaseRiskAssessment {
  level: ReleaseRiskLevel;
  /** Score 0..100 — used for visual gauges. Higher = riskier. */
  score: number;
  /** One-line summary for cards. */
  summary: string;
  /** Ranked contributing factors so the UI can explain *why*. */
  factors: { label: string; weight: number; detail: string }[];
  /** Whether the platform should require human approval before proceeding. */
  requiresApproval: boolean;
  /** Whether the platform should block the release entirely. */
  shouldBlock: boolean;
  /** Safe next action — the most prominent thing for the user to do. */
  safeNextAction?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface ReleaseRiskInputs {
  release: Release;
  readiness?: ServiceReadiness;
  blockers: DeploymentBlocker[];
  /** Recent failure history for this service, newest first. */
  recentFailures?: { releaseId: string; at: string }[];
  /** Number of deployments to this service in the last 24h — high churn raises risk. */
  deployVelocity24h?: number;
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

const ENV_WEIGHT: Record<EnvironmentName, number> = {
  development: 0,
  qa: 5,
  staging: 12,
  production: 25,
};

const BLOCKER_WEIGHT: Record<BlockerSeverity, number> = {
  info: 1,
  low: 3,
  medium: 8,
  high: 16,
  critical: 28,
};

const BLAST_WEIGHT: Record<"contained" | "moderate" | "broad", number> = {
  contained: 2,
  moderate: 8,
  broad: 18,
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function assessReleaseRisk(input: ReleaseRiskInputs): ReleaseRiskAssessment {
  const factors: { label: string; weight: number; detail: string }[] = [];

  // 1. Environment base risk
  const envW = ENV_WEIGHT[input.release.environment];
  if (envW > 0) {
    factors.push({
      label: "Production environment".replace("Production", labelEnv(input.release.environment)),
      weight: envW,
      detail: `Target environment is ${input.release.environment}.`,
    });
  }

  // 2. Blockers
  let blockerTotal = 0;
  for (const b of input.blockers) {
    blockerTotal += BLOCKER_WEIGHT[b.severity];
  }
  if (blockerTotal > 0) {
    factors.push({
      label: `${input.blockers.length} deployment blocker${input.blockers.length === 1 ? "" : "s"}`,
      weight: Math.min(60, blockerTotal),
      detail: input.blockers.slice(0, 3).map((b) => `· ${b.title}`).join("\n"),
    });
  }

  // 3. Blast radius
  if (input.release.blastRadius) {
    const w = BLAST_WEIGHT[input.release.blastRadius];
    factors.push({
      label: `Blast radius: ${input.release.blastRadius}`,
      weight: w,
      detail: `Release affects ${input.release.blastRadius === "broad" ? "many" : input.release.blastRadius === "moderate" ? "some" : "few"} downstream resources.`,
    });
  }

  // 4. Readiness gap
  if (input.readiness) {
    const gap = Math.max(0, 80 - input.readiness.compositeScore);
    if (gap > 0) {
      factors.push({
        label: `Readiness ${input.readiness.compositeScore}/100`,
        weight: Math.min(25, gap / 2),
        detail: `Service readiness is ${input.readiness.compositeScore}, gap to 80 is ${gap}.`,
      });
    }
  }

  // 5. Recent failures
  const recent = input.recentFailures ?? [];
  if (recent.length > 0) {
    factors.push({
      label: `${recent.length} recent failure${recent.length === 1 ? "" : "s"}`,
      weight: Math.min(20, recent.length * 6),
      detail: `Service has ${recent.length} failed release(s) in the recent window.`,
    });
  }

  // 6. Velocity
  if ((input.deployVelocity24h ?? 0) > 5) {
    factors.push({
      label: "High deploy velocity",
      weight: 6,
      detail: `${input.deployVelocity24h} deploys in the last 24h — change pile-up.`,
    });
  }

  // Score = sum capped at 100
  const score = Math.min(100, factors.reduce((s, f) => s + f.weight, 0));
  const level: ReleaseRiskLevel =
    score >= 80 ? "critical" :
    score >= 60 ? "elevated" :
    score >= 35 ? "moderate" :
    score >= 15 ? "low" :
                  "minimal";

  // Decisions
  const shouldBlock = input.blockers.some((b) => b.severity === "critical");
  const requiresApproval = !shouldBlock && (
    score >= 35 ||
    input.blockers.some((b) => b.severity === "high" || b.severity === "medium")
  );

  const summary =
    shouldBlock
      ? "Release is blocked — critical conditions present."
      : requiresApproval
        ? "Release requires human approval before it can proceed."
        : level === "minimal"
          ? "Release looks safe — no significant risk factors."
          : `Release carries ${level} risk — proceed with awareness.`;

  // Sort factors by weight desc
  factors.sort((a, b) => b.weight - a.weight);

  const safeNextAction: ReleaseRiskAssessment["safeNextAction"] =
    shouldBlock ? { label: "Open ReleaseOps", href: "/dashboard/releaseops" } :
    requiresApproval ? { label: "Open approvals", href: "/dashboard/approvals" } :
    undefined;

  return { level, score, summary, factors, requiresApproval, shouldBlock, safeNextAction };
}

function labelEnv(env: EnvironmentName): string {
  switch (env) {
    case "production":  return "Production environment";
    case "staging":     return "Staging environment";
    case "qa":          return "QA environment";
    case "development": return "Development environment";
  }
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const RISK_LABEL: Record<ReleaseRiskLevel, string> = {
  minimal:  "Minimal",
  low:      "Low",
  moderate: "Moderate",
  elevated: "Elevated",
  critical: "Critical",
};

export function riskSemantic(level: ReleaseRiskLevel): "success" | "neutral" | "warning" | "error" {
  switch (level) {
    case "minimal":  return "success";
    case "low":      return "success";
    case "moderate": return "warning";
    case "elevated": return "warning";
    case "critical": return "error";
  }
}
