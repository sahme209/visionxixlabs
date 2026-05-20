/**
 * Pure WCAG a11y audit aggregator.
 *
 * Folds raw axe-core / Lighthouse a11y findings into a per-route
 * scorecard with severity rollups + per-rule frequency + WCAG-level
 * blocking verdict. Pure / deterministic.
 */

export type WcagLevel = "A" | "AA" | "AAA";
export type AxeImpact = "minor" | "moderate" | "serious" | "critical";

export interface RawA11yFinding {
  ruleId: string;            // e.g. "color-contrast"
  impact: AxeImpact;
  wcagLevels: readonly WcagLevel[];
  route: string;             // page path
  /** Number of DOM nodes affected on this route. */
  nodeCount: number;
  /** Operator-readable summary. */
  description: string;
}

export interface RouteRow {
  route: string;
  totalFindings: number;
  byImpact: Record<AxeImpact, number>;
  status: "ok" | "warn" | "fail";
}

export interface RuleRow {
  ruleId: string;
  count: number;
  worstImpact: AxeImpact;
  affectedRoutes: number;
  example: string;
}

export interface AuditReport {
  routes: RouteRow[];
  topRules: RuleRow[];
  overall: "ok" | "warn" | "fail";
  /** Blocking iff any finding hits the requested WCAG level. */
  failsRequiredLevel: boolean;
}

export interface AuditOptions {
  /** Required compliance level (default "AA"). */
  requiredLevel?: WcagLevel;
  /** Impact level at or above which a finding is "blocking". Default "serious". */
  blockingImpact?: AxeImpact;
}

const IMPACT_RANK: Record<AxeImpact, number> = { minor: 0, moderate: 1, serious: 2, critical: 3 };
const LEVEL_RANK: Record<WcagLevel, number> = { A: 0, AA: 1, AAA: 2 };

const zeroByImpact = (): Record<AxeImpact, number> => ({ minor: 0, moderate: 0, serious: 0, critical: 0 });

function statusOf(byImpact: Record<AxeImpact, number>, blockingImpact: AxeImpact): RouteRow["status"] {
  const block = byImpact.critical + byImpact.serious + (blockingImpact === "moderate" ? byImpact.moderate : 0)
    + (blockingImpact === "minor" ? byImpact.minor + byImpact.moderate : 0);
  if (block > 0) return "fail";
  if (byImpact.moderate + byImpact.minor > 0) return "warn";
  return "ok";
}

export function aggregateA11yFindings(input: {
  findings: readonly RawA11yFinding[];
  options?: AuditOptions;
}): AuditReport {
  const requiredLevel = input.options?.requiredLevel ?? "AA";
  const blockingImpact = input.options?.blockingImpact ?? "serious";

  type RouteAcc = { totalFindings: number; byImpact: Record<AxeImpact, number> };
  const perRoute = new Map<string, RouteAcc>();
  type RuleAcc = { count: number; worstImpact: AxeImpact; routes: Set<string>; example: string };
  const perRule = new Map<string, RuleAcc>();
  let failsRequiredLevel = false;

  for (const f of input.findings) {
    if (f.wcagLevels.some((l) => LEVEL_RANK[l] <= LEVEL_RANK[requiredLevel]) && IMPACT_RANK[f.impact] >= IMPACT_RANK[blockingImpact]) {
      failsRequiredLevel = true;
    }
    const r = perRoute.get(f.route) ?? { totalFindings: 0, byImpact: zeroByImpact() };
    r.totalFindings += 1;
    r.byImpact[f.impact] += 1;
    perRoute.set(f.route, r);

    const rule = perRule.get(f.ruleId) ?? { count: 0, worstImpact: "minor", routes: new Set<string>(), example: f.description };
    rule.count += 1;
    rule.routes.add(f.route);
    if (IMPACT_RANK[f.impact] > IMPACT_RANK[rule.worstImpact]) rule.worstImpact = f.impact;
    perRule.set(f.ruleId, rule);
  }

  const routes: RouteRow[] = [...perRoute.entries()].map(([route, v]) => ({
    route,
    totalFindings: v.totalFindings,
    byImpact: v.byImpact,
    status: statusOf(v.byImpact, blockingImpact),
  })).sort((a, b) => {
    const rank: Record<RouteRow["status"], number> = { fail: 0, warn: 1, ok: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return b.totalFindings - a.totalFindings;
  });

  const topRules: RuleRow[] = [...perRule.entries()].map(([ruleId, v]) => ({
    ruleId,
    count: v.count,
    worstImpact: v.worstImpact,
    affectedRoutes: v.routes.size,
    example: v.example.slice(0, 200),
  })).sort((a, b) => b.count - a.count).slice(0, 20);

  const overall: AuditReport["overall"] =
    routes.some((r) => r.status === "fail") ? "fail"
    : routes.some((r) => r.status === "warn") ? "warn"
    : "ok";

  return { routes, topRules, overall, failsRequiredLevel };
}
