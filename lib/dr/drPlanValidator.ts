/**
 * Pure disaster-recovery plan validator.
 *
 * Operators declare a DR plan (per-service RTO/RPO + failover region
 * + last-tested timestamp + runbook id). This validator checks the
 * plan against compliance constraints (testing cadence, regional
 * isolation, sane RTO/RPO, runbook presence).
 *
 * Pure / deterministic.
 */

export interface DrServicePlan {
  service: string;
  /** RTO (recovery time objective) in minutes. */
  rtoMins: number;
  /** RPO (recovery point objective) in minutes. */
  rpoMins: number;
  /** Primary region (e.g. "us-east-1"). */
  primaryRegion: string;
  /** Failover region. Must differ from primaryRegion. */
  failoverRegion: string;
  /** ISO of last successful DR drill, null if never drilled. */
  lastDrillAtIso: string | null;
  /** Runbook id staged for this DR scenario. */
  drRunbookId: string | null;
  /** Tier of the service, drives required drill cadence. */
  tier: "tier_0" | "tier_1" | "tier_2" | "tier_3";
}

export type DrFindingKind =
  | "missing_failover_region"
  | "same_region_failover"
  | "missing_drill"
  | "drill_overdue"
  | "missing_runbook"
  | "rto_too_high"
  | "rpo_too_high"
  | "rpo_exceeds_rto";

export interface DrFinding {
  service: string;
  kind: DrFindingKind;
  detail: string;
  severity: "warn" | "fail";
}

export interface DrPlanRow {
  service: string;
  tier: DrServicePlan["tier"];
  findings: DrFinding[];
  status: "ok" | "warn" | "fail";
}

export interface DrPlanReport {
  rows: DrPlanRow[];
  totals: { ok: number; warn: number; fail: number };
  overall: "ok" | "warn" | "fail";
}

const DRILL_CADENCE_DAYS: Record<DrServicePlan["tier"], number> = {
  tier_0: 30,
  tier_1: 90,
  tier_2: 180,
  tier_3: 365,
};

/** Per-tier max acceptable RTO / RPO in minutes. */
const MAX_RTO: Record<DrServicePlan["tier"], number> = {
  tier_0: 15,
  tier_1: 60,
  tier_2: 240,
  tier_3: 1440,
};

const MAX_RPO: Record<DrServicePlan["tier"], number> = {
  tier_0: 5,
  tier_1: 30,
  tier_2: 120,
  tier_3: 1440,
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function validateDrPlan(input: {
  plans: readonly DrServicePlan[];
  nowIso?: string;
}): DrPlanReport {
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const rows: DrPlanRow[] = [];

  for (const p of input.plans) {
    const findings: DrFinding[] = [];

    if (!p.failoverRegion) {
      findings.push({ service: p.service, kind: "missing_failover_region", severity: "fail", detail: "no failover region declared" });
    } else if (p.failoverRegion === p.primaryRegion) {
      findings.push({ service: p.service, kind: "same_region_failover", severity: "fail", detail: `failover ${p.failoverRegion} === primary ${p.primaryRegion}` });
    }

    if (!p.drRunbookId) {
      findings.push({ service: p.service, kind: "missing_runbook", severity: "fail", detail: "no drRunbookId staged" });
    }

    if (p.lastDrillAtIso === null) {
      findings.push({ service: p.service, kind: "missing_drill", severity: "fail", detail: "DR has never been drilled" });
    } else {
      const ageDays = (now.getTime() - new Date(p.lastDrillAtIso).getTime()) / DAY_MS;
      const cadence = DRILL_CADENCE_DAYS[p.tier];
      if (ageDays > cadence) {
        findings.push({
          service: p.service, kind: "drill_overdue", severity: "warn",
          detail: `${Math.floor(ageDays)}d since last drill (cadence ${cadence}d for ${p.tier})`,
        });
      }
    }

    if (p.rtoMins > MAX_RTO[p.tier]) {
      findings.push({
        service: p.service, kind: "rto_too_high", severity: "fail",
        detail: `RTO ${p.rtoMins}m > max ${MAX_RTO[p.tier]}m for ${p.tier}`,
      });
    }
    if (p.rpoMins > MAX_RPO[p.tier]) {
      findings.push({
        service: p.service, kind: "rpo_too_high", severity: "fail",
        detail: `RPO ${p.rpoMins}m > max ${MAX_RPO[p.tier]}m for ${p.tier}`,
      });
    }
    if (p.rpoMins > p.rtoMins) {
      findings.push({
        service: p.service, kind: "rpo_exceeds_rto", severity: "warn",
        detail: `RPO ${p.rpoMins}m > RTO ${p.rtoMins}m (unusual — you can lose more than you can recover within)`,
      });
    }

    const status: DrPlanRow["status"] =
      findings.some((f) => f.severity === "fail") ? "fail"
      : findings.length > 0 ? "warn"
      : "ok";

    rows.push({ service: p.service, tier: p.tier, findings, status });
  }

  rows.sort((a, b) => {
    const rank: Record<DrPlanRow["status"], number> = { fail: 0, warn: 1, ok: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.service < b.service ? -1 : 1;
  });

  const totals = { ok: 0, warn: 0, fail: 0 };
  for (const r of rows) totals[r.status] += 1;

  const overall: DrPlanReport["overall"] =
    totals.fail > 0 ? "fail" : totals.warn > 0 ? "warn" : "ok";

  return { rows, totals, overall };
}
