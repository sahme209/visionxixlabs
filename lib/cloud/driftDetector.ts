/**
 * Pure drift detector.
 *
 * Compares a `desired` resource configuration against the `observed`
 * configuration and produces a structured diff. Used by the autonomy
 * loop to decide whether to stage a remediation runbook + by the UI
 * to show operators a side-by-side.
 *
 * Pure / deterministic. No DB. The caller is responsible for fetching
 * desired (Terraform / charter) + observed (cloud inventory) blobs.
 */

export type DriftKind = "missing" | "extra" | "value_changed" | "no_drift";

export interface DriftRow {
  path: string;
  kind: DriftKind;
  desired: unknown;
  observed: unknown;
}

export interface DriftReport {
  driftCount: number;
  hasDrift: boolean;
  rows: DriftRow[];
  severity: "ok" | "low" | "medium" | "high";
}

export interface DriftOptions {
  ignorePaths?: readonly string[];
  highPriorityPaths?: readonly string[];
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const startsWithAny = (path: string, prefixes: readonly string[]): boolean => {
  for (const p of prefixes) if (path === p || path.startsWith(`${p}.`)) return true;
  return false;
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) if (ak[i] !== bk[i]) return false;
    for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

function walk(desired: unknown, observed: unknown, path: string, rows: DriftRow[]): void {
  if (deepEqual(desired, observed)) return;

  if (isPlainObject(desired) && isPlainObject(observed)) {
    const keys = new Set<string>([...Object.keys(desired), ...Object.keys(observed)]);
    for (const k of keys) {
      const next = path ? `${path}.${k}` : k;
      if (k in desired && !(k in observed)) {
        rows.push({ path: next, kind: "missing", desired: desired[k], observed: undefined });
      } else if (!(k in desired) && k in observed) {
        rows.push({ path: next, kind: "extra", desired: undefined, observed: observed[k] });
      } else {
        walk(desired[k], observed[k], next, rows);
      }
    }
    return;
  }

  rows.push({ path: path || "$", kind: "value_changed", desired, observed });
}

const rankSeverity = (count: number, hits: number): DriftReport["severity"] => {
  if (count === 0) return "ok";
  if (hits > 0) return "high";
  if (count >= 5) return "high";
  if (count >= 2) return "medium";
  return "low";
};

export function detectDrift(desired: unknown, observed: unknown, opts?: DriftOptions): DriftReport {
  const rows: DriftRow[] = [];
  walk(desired, observed, "", rows);

  const ignore = opts?.ignorePaths ?? [];
  const high = opts?.highPriorityPaths ?? [];

  const filtered = rows.filter((r) => !startsWithAny(r.path, ignore));
  const highHits = filtered.filter((r) => startsWithAny(r.path, high)).length;
  const driftCount = filtered.length;

  return {
    driftCount,
    hasDrift: driftCount > 0,
    rows: filtered,
    severity: rankSeverity(driftCount, highHits),
  };
}
