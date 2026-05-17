/**
 * Production readiness model.
 *
 * Defines the typed contract for "is this deployment ready for production
 * use, and if not, what's missing?". The runner aggregates results from
 * the validation matrix, operating loop builder, environment loader, and
 * the honesty + exhaustiveness checkers.
 *
 * This is the **single source of truth** for the readiness score the
 * Command Center renders.
 */

export type ReadinessCategory =
  | "build_health"
  | "type_safety"
  | "route_health"
  | "api_health"
  | "provider_readiness"
  | "security_readiness"
  | "persistence_readiness"
  | "desktop_readiness"
  | "operating_loop_readiness"
  | "remediation_readiness"
  | "simulation_readiness"
  | "approval_readiness"
  | "audit_trace_readiness"
  | "self_serve_readiness"
  | "product_honesty_readiness";

export type ReadinessStatus =
  | "passing"
  | "failing"
  | "partial"
  | "preview"
  | "blocked"
  | "skipped";

export type ReadinessSeverity = "critical" | "high" | "medium" | "low";

export type ReadinessSourceMode = "live" | "partial" | "preview" | "disabled" | "unknown";

export interface ReadinessCheck {
  id: string;
  category: ReadinessCategory;
  title: string;
  status: ReadinessStatus;
  severity: ReadinessSeverity;
  /** Short evidence string (file path / matrix row id / etc.). */
  evidence: string;
  /** Files touched by this check (for navigation). */
  affectedFiles?: string[];
  /** Routes touched by this check. */
  affectedRoutes?: string[];
  /** Honest next-fix line — never a "book a call" pointer. */
  nextFix?: string;
  sourceMode: ReadinessSourceMode;
  lastCheckedAt: string;
}

export interface CategoryScore {
  category: ReadinessCategory;
  /** 0..1. */
  score: number;
  total: number;
  passing: number;
  partial: number;
  preview: number;
  failing: number;
  blocked: number;
}

export interface ProductionReadinessReport {
  generatedAt: string;
  /** 0..1 — composite across categories. */
  overallScore: number;
  /** Per-category scores. */
  categoryScores: CategoryScore[];
  /** All raw checks (in stable order). */
  checks: ReadinessCheck[];
  /** Highest-priority issues to fix next. */
  criticalFailures: ReadinessCheck[];
  /** Severity high but not critical. */
  highRiskGaps: ReadinessCheck[];
  /** Honest preview-only areas (not failures, just not live). */
  previewOnlyAreas: ReadinessCheck[];
  /** Blocked-on-config areas. */
  blockedAreas: ReadinessCheck[];
  /** Suggested next focused fixes (≤5 items, ordered). */
  recommendedNextFixes: { id: string; title: string; reason: string; href?: string }[];
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

const STATUS_WEIGHT: Record<ReadinessStatus, number> = {
  passing: 1.0,
  partial: 0.6,
  preview: 0.4,
  blocked: 0.2,
  failing: 0.0,
  skipped: 0.5, // skipped contributes neutrally to avoid punishing intentionally-skipped scopes
};

export function scoreOf(status: ReadinessStatus): number {
  return STATUS_WEIGHT[status];
}

const SEVERITY_RANK: Record<ReadinessSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

export function rankSeverity(s: ReadinessSeverity): number {
  return SEVERITY_RANK[s];
}

export const CATEGORY_LABEL: Record<ReadinessCategory, string> = {
  build_health:            "Build health",
  type_safety:             "Type safety",
  route_health:            "Route health",
  api_health:              "API health",
  provider_readiness:      "Provider readiness",
  security_readiness:      "Security readiness",
  persistence_readiness:   "Persistence readiness",
  desktop_readiness:       "Desktop readiness",
  operating_loop_readiness:"Operating loop readiness",
  remediation_readiness:   "Remediation readiness",
  simulation_readiness:    "Simulation readiness",
  approval_readiness:      "Approval readiness",
  audit_trace_readiness:   "Audit + trace readiness",
  self_serve_readiness:    "Self-serve readiness",
  product_honesty_readiness:"Product honesty",
};

/** Compute per-category scores given a flat list of checks. */
export function summariseByCategory(checks: ReadinessCheck[]): CategoryScore[] {
  const grouped = new Map<ReadinessCategory, ReadinessCheck[]>();
  for (const c of checks) {
    const list = grouped.get(c.category) ?? [];
    list.push(c);
    grouped.set(c.category, list);
  }
  const out: CategoryScore[] = [];
  for (const [category, list] of grouped) {
    const total = list.length;
    const passing = list.filter((c) => c.status === "passing").length;
    const partial = list.filter((c) => c.status === "partial").length;
    const preview = list.filter((c) => c.status === "preview").length;
    const blocked = list.filter((c) => c.status === "blocked").length;
    const failing = list.filter((c) => c.status === "failing").length;
    const sumScore = list.reduce((s, c) => s + scoreOf(c.status), 0);
    const score = total === 0 ? 0 : sumScore / total;
    out.push({ category, score, total, passing, partial, preview, failing, blocked });
  }
  return out;
}

/** Overall weighted score: critical-category weight × score. */
export function computeOverallScore(scores: CategoryScore[]): number {
  if (scores.length === 0) return 0;
  // Equal weights today — explicit per-category weights can land later.
  const sum = scores.reduce((s, c) => s + c.score, 0);
  return sum / scores.length;
}
