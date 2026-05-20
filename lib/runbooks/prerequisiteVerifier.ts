/**
 * Pure runbook prerequisite verifier.
 *
 * A runbook declares prerequisites (e.g. "approver_role:platform_admin",
 * "feature_flag:s3_pab_tightening:on", "service_health:checkout:operational").
 * Given current tenant state, return per-prereq pass/fail + an aggregate
 * verdict. Operators see this BEFORE staging.
 *
 * Pure / deterministic. No DB.
 */

export type PrereqKind = "approver_role" | "feature_flag" | "service_health" | "boundary_class" | "tier_minimum";

export interface RunbookPrerequisite {
  kind: PrereqKind;
  /** Key like "approver_role:platform_admin" — caller-supplied. */
  selector: string;
  /** Operator-readable reason this prereq exists. */
  reason: string;
}

export interface TenantState {
  approverRoles: readonly string[];
  featureFlags: Record<string, "on" | "off">;
  serviceHealth: Record<string, "operational" | "degraded" | "down" | "unknown">;
  boundaryClass: string;       // e.g. "low_blast_radius"
  tier: "trial" | "starter" | "growth" | "scale" | "enterprise";
}

export interface PrereqCheckRow {
  prereq: RunbookPrerequisite;
  passed: boolean;
  detail: string;
}

export interface PrereqVerdict {
  rows: PrereqCheckRow[];
  passedCount: number;
  failedCount: number;
  /** True iff every prereq passes. */
  allPassed: boolean;
}

const TIER_RANK: Record<TenantState["tier"], number> = {
  trial: 0, starter: 1, growth: 2, scale: 3, enterprise: 4,
};

function verifyOne(prereq: RunbookPrerequisite, state: TenantState): PrereqCheckRow {
  const sel = prereq.selector;
  switch (prereq.kind) {
    case "approver_role": {
      const role = sel.replace(/^approver_role:/, "");
      const passed = state.approverRoles.includes(role);
      return { prereq, passed, detail: passed ? `role ${role} present` : `role ${role} missing` };
    }
    case "feature_flag": {
      // "feature_flag:<key>:<expected>" — default expected "on".
      const parts = sel.replace(/^feature_flag:/, "").split(":");
      const key = parts[0];
      const expected = (parts[1] ?? "on") as "on" | "off";
      const actual = state.featureFlags[key] ?? "off";
      const passed = actual === expected;
      return { prereq, passed, detail: `flag ${key} is ${actual} (expected ${expected})` };
    }
    case "service_health": {
      const svc = sel.replace(/^service_health:/, "");
      const actual = state.serviceHealth[svc] ?? "unknown";
      const passed = actual === "operational";
      return { prereq, passed, detail: `service ${svc} is ${actual}` };
    }
    case "boundary_class": {
      const cls = sel.replace(/^boundary_class:/, "");
      const passed = state.boundaryClass === cls;
      return { prereq, passed, detail: `boundary is ${state.boundaryClass} (expected ${cls})` };
    }
    case "tier_minimum": {
      const min = sel.replace(/^tier_minimum:/, "") as TenantState["tier"];
      const passed = (TIER_RANK[state.tier] ?? -1) >= (TIER_RANK[min] ?? Infinity);
      return { prereq, passed, detail: `tenant is ${state.tier} (need ≥ ${min})` };
    }
  }
}

export function verifyPrerequisites(
  prereqs: readonly RunbookPrerequisite[],
  state: TenantState,
): PrereqVerdict {
  const rows = prereqs.map((p) => verifyOne(p, state));
  const passedCount = rows.filter((r) => r.passed).length;
  return {
    rows,
    passedCount,
    failedCount: rows.length - passedCount,
    allPassed: passedCount === rows.length,
  };
}
