/**
 * Pure security-finding deduplicator.
 *
 * Cloud scanners often emit "the same problem on N resources" as N
 * rows. This module groups by (controlId, severity, normalized
 * fingerprint) and emits a single row per cluster with the count,
 * first/last seen, and the set of affected resource ids.
 *
 * Pure / deterministic. No DB.
 */

export interface RawFinding {
  id: string;
  controlId: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  resourceId: string;
  fingerprint?: string;       // optional caller-supplied stable hash
  firstSeen: string;          // ISO
  lastSeen: string;           // ISO
}

export interface DedupedFinding {
  controlId: string;
  severity: RawFinding["severity"];
  fingerprint: string;
  affectedResourceIds: string[];
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export interface DedupeReport {
  inputCount: number;
  clusters: DedupedFinding[];
  /** Aggregate metric: how many raw rows folded into clusters. */
  collapseRatio: number;  // 0 = nothing collapsed; 1 = single mega-cluster
}

const fingerprintOf = (raw: RawFinding): string => {
  if (raw.fingerprint && raw.fingerprint.length > 0) return raw.fingerprint;
  // Default: control + severity (so different resources with the same
  // control + severity fold together).
  return `${raw.controlId}::${raw.severity}`;
};

export function dedupeFindings(findings: readonly RawFinding[]): DedupeReport {
  const buckets = new Map<string, DedupedFinding>();
  for (const f of findings) {
    const fp = fingerprintOf(f);
    const key = `${f.controlId}::${f.severity}::${fp}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        controlId: f.controlId,
        severity: f.severity,
        fingerprint: fp,
        affectedResourceIds: [f.resourceId],
        count: 1,
        firstSeen: f.firstSeen,
        lastSeen: f.lastSeen,
      });
      continue;
    }
    existing.count += 1;
    if (!existing.affectedResourceIds.includes(f.resourceId)) {
      existing.affectedResourceIds.push(f.resourceId);
    }
    if (f.firstSeen < existing.firstSeen) existing.firstSeen = f.firstSeen;
    if (f.lastSeen > existing.lastSeen) existing.lastSeen = f.lastSeen;
  }

  const clusters = [...buckets.values()]
    .map((c) => ({ ...c, affectedResourceIds: [...c.affectedResourceIds].sort() }))
    .sort((a, b) => b.count - a.count);

  const inputCount = findings.length;
  const collapseRatio = inputCount === 0 ? 0 : 1 - clusters.length / inputCount;

  return { inputCount, clusters, collapseRatio };
}
