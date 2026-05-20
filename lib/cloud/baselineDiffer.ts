/**
 * Pure cloud-baseline differ.
 *
 * For each observed resource, compare its config keys to an opinionated
 * baseline (per resource type) and report which baseline assertions are
 * satisfied, violated, or unknown (key not present at all). Used by
 * the security cockpit's "baseline" tab to spot drift from Axiom's
 * default-secure stance.
 *
 * Pure / deterministic. No DB.
 */

export interface BaselineAssertion {
  key: string;                     // dotted path, e.g. "encryption.atRest"
  expectedValue: unknown;
  reason: string;                  // operator-readable
}

export interface BaselineSet {
  resourceType: string;            // e.g. "aws_s3_bucket"
  assertions: readonly BaselineAssertion[];
}

export interface ResourceConfig {
  id: string;
  resourceType: string;
  /** Flattened key/value bag the differ inspects. */
  config: Readonly<Record<string, unknown>>;
}

export interface AssertionRow {
  resourceId: string;
  resourceType: string;
  key: string;
  status: "ok" | "violation" | "unknown";
  expected: unknown;
  observed: unknown;
  reason: string;
}

export interface BaselineDiffReport {
  rows: AssertionRow[];
  totals: { ok: number; violation: number; unknown: number };
  perResource: Array<{ resourceId: string; violations: number; unknowns: number }>;
  severity: "ok" | "low" | "medium" | "high";
}

function lookupKey(config: Readonly<Record<string, unknown>>, dottedKey: string): { found: boolean; value: unknown } {
  const parts = dottedKey.split(".");
  let cur: unknown = config;
  for (const p of parts) {
    if (cur && typeof cur === "object" && !Array.isArray(cur) && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return { found: false, value: undefined };
    }
  }
  return { found: true, value: cur };
}

function rankSeverity(violations: number, unknowns: number): BaselineDiffReport["severity"] {
  if (violations >= 5) return "high";
  if (violations >= 1) return "medium";
  if (unknowns > 0) return "low";
  return "ok";
}

export function diffAgainstBaseline(input: {
  resources: readonly ResourceConfig[];
  baselines: readonly BaselineSet[];
}): BaselineDiffReport {
  const baselineByType = new Map<string, BaselineSet>();
  for (const b of input.baselines) baselineByType.set(b.resourceType, b);

  const rows: AssertionRow[] = [];
  const totals = { ok: 0, violation: 0, unknown: 0 };
  const perResource = new Map<string, { violations: number; unknowns: number }>();

  for (const r of input.resources) {
    const baseline = baselineByType.get(r.resourceType);
    if (!baseline) continue;
    for (const a of baseline.assertions) {
      const { found, value } = lookupKey(r.config, a.key);
      let status: AssertionRow["status"];
      if (!found) status = "unknown";
      else status = value === a.expectedValue ? "ok" : "violation";
      rows.push({
        resourceId: r.id, resourceType: r.resourceType,
        key: a.key, status, expected: a.expectedValue, observed: value, reason: a.reason,
      });
      totals[status] += 1;
      const pr = perResource.get(r.id) ?? { violations: 0, unknowns: 0 };
      if (status === "violation") pr.violations += 1;
      else if (status === "unknown") pr.unknowns += 1;
      perResource.set(r.id, pr);
    }
  }

  const perResourceRows = [...perResource.entries()]
    .map(([resourceId, v]) => ({ resourceId, ...v }))
    .filter((p) => p.violations + p.unknowns > 0)
    .sort((a, b) => (b.violations - a.violations) || (b.unknowns - a.unknowns));

  return {
    rows,
    totals,
    perResource: perResourceRows,
    severity: rankSeverity(totals.violation, totals.unknown),
  };
}
