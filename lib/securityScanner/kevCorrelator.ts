/**
 * Pure KEV (Known Exploited Vulnerabilities) correlator.
 *
 * Given a list of detected CVEs in the tenant's inventory + the CISA
 * KEV catalog (with `dueDate` from the catalog feed), surface the ones
 * that:
 *   - appear in the KEV catalog at all (known exploited),
 *   - are past the catalog's `dueDate`,
 *   - have high impact on the tenant's resources (count + service).
 *
 * Pure / deterministic. No DB. No network — caller supplies the KEV
 * catalog as a fixture.
 */

export interface DetectedCve {
  cveId: string;
  resourceId: string;
  service: string;
}

export interface KevEntry {
  cveId: string;
  /** ISO date the entry was added to the KEV catalog. */
  dateAdded: string;
  /** ISO date by which CISA requires mitigation (federal context). */
  dueDate: string;
  shortDescription: string;
}

export interface KevCorrelationRow {
  cveId: string;
  /** Number of detected occurrences in the tenant's inventory. */
  affectedCount: number;
  affectedResourceIds: string[];
  affectedServices: string[];
  kev: KevEntry;
  /** True iff KEV's dueDate < `now`. */
  pastDue: boolean;
  /** Severity ladder: critical when pastDue, high when affectedCount>=5, medium when >=2, else low. */
  severity: "low" | "medium" | "high" | "critical";
}

export interface KevCorrelationReport {
  matchedCount: number;
  unmatchedDetections: DetectedCve[];
  rows: KevCorrelationRow[];
}

function rankSeverity(pastDue: boolean, count: number): KevCorrelationRow["severity"] {
  if (pastDue) return "critical";
  if (count >= 5) return "high";
  if (count >= 2) return "medium";
  return "low";
}

export function correlateKev(input: {
  detections: readonly DetectedCve[];
  kevCatalog: readonly KevEntry[];
  /** "today" in ISO. Default = new Date().toISOString(). */
  now?: string;
}): KevCorrelationReport {
  const now = input.now ?? new Date().toISOString();
  const kevById = new Map<string, KevEntry>();
  for (const k of input.kevCatalog) kevById.set(k.cveId, k);

  const byCve = new Map<string, { resources: Set<string>; services: Set<string> }>();
  const unmatchedDetections: DetectedCve[] = [];

  for (const d of input.detections) {
    if (!kevById.has(d.cveId)) {
      unmatchedDetections.push(d);
      continue;
    }
    const bucket = byCve.get(d.cveId) ?? { resources: new Set<string>(), services: new Set<string>() };
    bucket.resources.add(d.resourceId);
    bucket.services.add(d.service);
    byCve.set(d.cveId, bucket);
  }

  const rows: KevCorrelationRow[] = [];
  for (const [cveId, b] of byCve) {
    const kev = kevById.get(cveId)!;
    const pastDue = kev.dueDate < now;
    const affectedCount = b.resources.size;
    rows.push({
      cveId,
      affectedCount,
      affectedResourceIds: [...b.resources].sort(),
      affectedServices: [...b.services].sort(),
      kev,
      pastDue,
      severity: rankSeverity(pastDue, affectedCount),
    });
  }

  rows.sort((a, b) => {
    const sev = ["critical", "high", "medium", "low"];
    const sa = sev.indexOf(a.severity), sb = sev.indexOf(b.severity);
    if (sa !== sb) return sa - sb;
    return b.affectedCount - a.affectedCount;
  });

  return { matchedCount: rows.length, unmatchedDetections, rows };
}
