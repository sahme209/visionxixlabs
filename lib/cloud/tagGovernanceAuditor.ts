/**
 * Pure tag governance auditor.
 *
 * Walks a flat resource inventory and reports which required tags are
 * missing per resource, total coverage %, and the top offenders by
 * missing-tag count. Used by the cost / compliance dashboards to spot
 * tag drift before it makes the bill un-allocatable.
 *
 * Pure / deterministic. No DB.
 */

export interface TaggedResource {
  id: string;
  service: string;       // for grouping in the report
  tags: Record<string, string>;
}

export interface TagAuditInput {
  resources: readonly TaggedResource[];
  requiredTagKeys: readonly string[];
  /** Optional regex allowlist per tag key. If set, the tag's value must match. */
  valuePatterns?: Record<string, RegExp>;
}

export interface TagAuditRow {
  resourceId: string;
  service: string;
  missingTags: string[];
  invalidValueTags: string[];
}

export interface TagAuditReport {
  totalResources: number;
  fullyTaggedCount: number;
  /** 0..1 — fraction of resources with no missing / invalid tags. */
  coverage: number;
  /** Rows that have at least one issue, sorted by issue count desc. */
  offenders: TagAuditRow[];
  /** Sum of missing-tag occurrences across the input. */
  totalMissing: number;
  /** Sum of invalid-value occurrences. */
  totalInvalid: number;
}

export function auditTags(input: TagAuditInput): TagAuditReport {
  const required = input.requiredTagKeys;
  const patterns = input.valuePatterns ?? {};
  const offenders: TagAuditRow[] = [];
  let totalMissing = 0;
  let totalInvalid = 0;
  let fullyTagged = 0;

  for (const r of input.resources) {
    const missing: string[] = [];
    const invalid: string[] = [];
    for (const key of required) {
      const v = r.tags[key];
      if (v === undefined || v === null || v.length === 0) {
        missing.push(key);
        continue;
      }
      const re = patterns[key];
      if (re && !re.test(v)) invalid.push(key);
    }
    if (missing.length === 0 && invalid.length === 0) {
      fullyTagged += 1;
    } else {
      offenders.push({ resourceId: r.id, service: r.service, missingTags: missing, invalidValueTags: invalid });
    }
    totalMissing += missing.length;
    totalInvalid += invalid.length;
  }

  offenders.sort((a, b) => {
    const ai = a.missingTags.length + a.invalidValueTags.length;
    const bi = b.missingTags.length + b.invalidValueTags.length;
    if (bi !== ai) return bi - ai;
    return a.resourceId < b.resourceId ? -1 : 1;
  });

  const total = input.resources.length;
  const coverage = total === 0 ? 1 : fullyTagged / total;

  return {
    totalResources: total,
    fullyTaggedCount: fullyTagged,
    coverage,
    offenders,
    totalMissing,
    totalInvalid,
  };
}
