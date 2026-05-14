/**
 * Canonical status enums used across the platform.
 *
 * Multiple subsystems historically defined their own status strings
 * ("running" / "Running" / "in_progress" / "active" …). This file is the
 * single source of truth for surfaces UIs render — pills, semantic colors,
 * neutral / running / success / warning / error.
 */

/** The four-way operational health a node/resource/connector can be in. */
export type OperationalHealth = "operational" | "degraded" | "unhealthy" | "unknown";

/** Risk severity used by findings, recommendations, and policy decisions. */
export type RiskLevel = "info" | "low" | "medium" | "high" | "critical";

/** UI semantic — drives Tailwind class selection downstream. */
export type SemanticTone = "neutral" | "running" | "success" | "warning" | "error";

/** Run lifecycle for any async job / workflow / execution run. */
export type RunStatus =
  | "queued"
  | "running"
  | "paused"
  | "blocked"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out";

/** Map RiskLevel → SemanticTone. */
export function riskTone(level: RiskLevel): SemanticTone {
  switch (level) {
    case "info":     return "neutral";
    case "low":      return "neutral";
    case "medium":   return "warning";
    case "high":     return "warning";
    case "critical": return "error";
  }
}

/** Map OperationalHealth → SemanticTone. */
export function healthTone(h: OperationalHealth): SemanticTone {
  switch (h) {
    case "operational": return "success";
    case "degraded":    return "warning";
    case "unhealthy":   return "error";
    case "unknown":     return "neutral";
  }
}

/** Map RunStatus → SemanticTone. */
export function runTone(s: RunStatus): SemanticTone {
  switch (s) {
    case "queued":     return "neutral";
    case "running":    return "running";
    case "paused":     return "warning";
    case "blocked":    return "warning";
    case "succeeded":  return "success";
    case "failed":     return "error";
    case "cancelled":  return "neutral";
    case "timed_out":  return "error";
  }
}

/** Numeric risk weighting — for sorting/scoring, not display. */
export const RISK_WEIGHT: Record<RiskLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Compare two risk levels. Returns >0 if a is more severe than b. */
export function compareRisk(a: RiskLevel, b: RiskLevel): number {
  return RISK_WEIGHT[a] - RISK_WEIGHT[b];
}

/** Returns the higher of two risk levels. */
export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return compareRisk(a, b) >= 0 ? a : b;
}
