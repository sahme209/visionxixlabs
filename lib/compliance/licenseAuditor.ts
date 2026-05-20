/**
 * Pure dependency-license auditor.
 *
 * Given an SBOM-like list of (package, version, spdxLicense), classify
 * each entry against the operator's allow / warn / deny policy and
 * report:
 *   - violations (deny-listed),
 *   - warnings (warn-listed),
 *   - unknown (no SPDX license declared),
 *   - per-license summary counts.
 *
 * Pure / deterministic. No DB.
 */

export interface SbomEntry {
  packageName: string;
  version: string;
  spdxLicense: string | null;
}

export interface LicensePolicy {
  /** SPDX ids explicitly allowed. */
  allow: readonly string[];
  /** SPDX ids that emit a warning. */
  warn: readonly string[];
  /** SPDX ids that are violations. */
  deny: readonly string[];
}

export interface LicenseRow {
  packageName: string;
  version: string;
  spdxLicense: string;
  verdict: "allow" | "warn" | "deny" | "unknown";
}

export interface LicenseAuditReport {
  rows: LicenseRow[];
  totals: { allow: number; warn: number; deny: number; unknown: number };
  byLicense: Array<{ license: string; count: number }>;
  /** Severity ladder for the overall audit. */
  severity: "ok" | "warn" | "fail";
}

const normalize = (s: string | null): string => (s ?? "").trim().toUpperCase();
const NORMALIZED_UNKNOWN = "(NONE)";

function classify(spdx: string, policy: LicensePolicy): LicenseRow["verdict"] {
  if (spdx === NORMALIZED_UNKNOWN) return "unknown";
  const denySet = new Set(policy.deny.map((s) => s.toUpperCase()));
  const warnSet = new Set(policy.warn.map((s) => s.toUpperCase()));
  const allowSet = new Set(policy.allow.map((s) => s.toUpperCase()));
  if (denySet.has(spdx)) return "deny";
  if (warnSet.has(spdx)) return "warn";
  if (allowSet.has(spdx)) return "allow";
  // Unrecognized by policy → warn (operator can refine).
  return "warn";
}

export function auditLicenses(input: {
  entries: readonly SbomEntry[];
  policy: LicensePolicy;
}): LicenseAuditReport {
  const totals = { allow: 0, warn: 0, deny: 0, unknown: 0 };
  const perLicense = new Map<string, number>();
  const rows: LicenseRow[] = [];

  for (const e of input.entries) {
    const spdx = e.spdxLicense === null || normalize(e.spdxLicense) === ""
      ? NORMALIZED_UNKNOWN
      : normalize(e.spdxLicense);
    const verdict = classify(spdx, input.policy);
    totals[verdict] += 1;
    perLicense.set(spdx, (perLicense.get(spdx) ?? 0) + 1);
    rows.push({ packageName: e.packageName, version: e.version, spdxLicense: spdx, verdict });
  }

  const byLicense = [...perLicense.entries()]
    .map(([license, count]) => ({ license, count }))
    .sort((a, b) => b.count - a.count);

  const severity: LicenseAuditReport["severity"] =
    totals.deny > 0 ? "fail"
    : totals.warn > 0 || totals.unknown > 0 ? "warn"
    : "ok";

  return { rows, totals, byLicense, severity };
}
