/**
 * Phase 485 — drift detector.
 *
 * Pure function: given a declared-state set + observed-state set,
 * returns a typed list of drift findings. No I/O. Provider-specific
 * extractors (Terraform plan → declared, AWS describe → observed)
 * feed this kernel.
 *
 * Severity heuristics live here so the persistence layer just
 * upserts what the detector emits.
 */

/* ──────────────────────────────────────────────────────────────────
   Closed-union types.
   ────────────────────────────────────────────────────────────── */

export const ALL_RESOURCE_KINDS = [
  "aws_resource", "azure_resource", "gcp_resource",
  "k8s_resource", "helm_release", "terraform_resource",
  "database_object", "runtime_config",
] as const;
export type ResourceKind = (typeof ALL_RESOURCE_KINDS)[number];

export const ALL_DRIFT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type DriftSeverity = (typeof ALL_DRIFT_SEVERITIES)[number];

/* ──────────────────────────────────────────────────────────────────
   Inputs.
   ────────────────────────────────────────────────────────────── */

export interface DeclaredResource {
  resourceKind: ResourceKind;
  resourceId: string;
  displayName: string;
  applicationId?: string;
  environmentTier?: string;
  /** Stable subset of attributes the IaC source declares. */
  attributes: Record<string, unknown>;
  /** Attributes that the team considers "sensitive" — drift here is severe. */
  sensitiveAttributeKeys?: ReadonlyArray<string>;
}

export interface ObservedResource {
  resourceKind: ResourceKind;
  resourceId: string;
  displayName?: string;
  /** Attributes the cloud / runtime API actually reports. */
  attributes: Record<string, unknown>;
}

export interface DetectDriftInput {
  declared: ReadonlyArray<DeclaredResource>;
  observed: ReadonlyArray<ObservedResource>;
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface DriftFinding {
  resourceKind: ResourceKind;
  resourceId: string;
  displayName: string;
  applicationId?: string;
  environmentTier?: string;
  severity: DriftSeverity;
  summary: string;
  declaredJson: Record<string, unknown>;
  observedJson: Record<string, unknown>;
  /** Attribute keys where declared and observed disagree. */
  differingKeys: ReadonlyArray<string>;
  /** True iff one or more differing keys was marked sensitive. */
  sensitiveDrift: boolean;
}

export interface DriftDetectorResult {
  findings: DriftFinding[];
  /** Resources declared but not observed (deleted in runtime). */
  missingFromRuntime: ReadonlyArray<{ resourceKind: ResourceKind; resourceId: string; displayName: string }>;
  /** Resources observed but not declared (created out-of-band). */
  unmanagedDiscovered: ReadonlyArray<{ resourceKind: ResourceKind; resourceId: string; displayName: string }>;
  summary: {
    totalResources: number;
    driftedCount: number;
    bySeverity: Record<DriftSeverity, number>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function detectDrift(input: DetectDriftInput): DriftDetectorResult {
  const declaredByKey = new Map<string, DeclaredResource>();
  for (const d of input.declared) declaredByKey.set(keyOf(d), d);

  const observedByKey = new Map<string, ObservedResource>();
  for (const o of input.observed) observedByKey.set(keyOf(o), o);

  const findings: DriftFinding[] = [];
  const missingFromRuntime: Array<{ resourceKind: ResourceKind; resourceId: string; displayName: string }> = [];
  const unmanagedDiscovered: Array<{ resourceKind: ResourceKind; resourceId: string; displayName: string }> = [];

  // Compare declared ↔ observed for each declared resource.
  for (const decl of input.declared) {
    const obs = observedByKey.get(keyOf(decl));
    if (!obs) {
      missingFromRuntime.push({
        resourceKind: decl.resourceKind,
        resourceId: decl.resourceId,
        displayName: decl.displayName,
      });
      continue;
    }
    const differing = diffAttributes(decl.attributes, obs.attributes);
    if (differing.length === 0) continue;

    const sensitiveKeys = new Set(decl.sensitiveAttributeKeys ?? []);
    const sensitiveDrift = differing.some((k) => sensitiveKeys.has(k));

    findings.push({
      resourceKind: decl.resourceKind,
      resourceId: decl.resourceId,
      displayName: decl.displayName,
      ...(decl.applicationId !== undefined ? { applicationId: decl.applicationId } : {}),
      ...(decl.environmentTier !== undefined ? { environmentTier: decl.environmentTier } : {}),
      severity: severityFor(differing.length, sensitiveDrift, decl.environmentTier),
      summary: summarize(decl.displayName, differing, obs.attributes, decl.attributes),
      declaredJson: decl.attributes,
      observedJson: obs.attributes,
      differingKeys: differing,
      sensitiveDrift,
    });
  }

  // Observed-only — drifted out of source-of-truth.
  for (const obs of input.observed) {
    if (!declaredByKey.has(keyOf(obs))) {
      unmanagedDiscovered.push({
        resourceKind: obs.resourceKind,
        resourceId: obs.resourceId,
        displayName: obs.displayName ?? obs.resourceId,
      });
    }
  }

  const bySeverity: Record<DriftSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const f of findings) bySeverity[f.severity] += 1;

  return {
    findings,
    missingFromRuntime,
    unmanagedDiscovered,
    summary: {
      totalResources: input.declared.length,
      driftedCount: findings.length,
      bySeverity,
    },
  };
}

/* ──────────────────────────────────────────────────────────────────
   Helpers — exported for testing.
   ────────────────────────────────────────────────────────────── */

export function diffAttributes(
  declared: Record<string, unknown>,
  observed: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(declared), ...Object.keys(observed)]);
  const out: string[] = [];
  for (const k of keys) {
    const a = declared[k];
    const b = observed[k];
    if (!deepEqual(a, b)) out.push(k);
  }
  return out.sort();
}

export function severityFor(
  differingCount: number,
  sensitiveDrift: boolean,
  environmentTier?: string,
): DriftSeverity {
  if (sensitiveDrift) return "critical";
  if (environmentTier === "prod" && differingCount > 0) {
    return differingCount >= 3 ? "high" : "medium";
  }
  if (differingCount >= 5) return "high";
  if (differingCount >= 2) return "medium";
  return "low";
}

function summarize(
  name: string,
  keys: ReadonlyArray<string>,
  observed: Record<string, unknown>,
  declared: Record<string, unknown>,
): string {
  if (keys.length === 0) return `${name} has no detected drift.`;
  const firstKey = keys[0];
  const a = JSON.stringify(declared[firstKey] ?? null);
  const b = JSON.stringify(observed[firstKey] ?? null);
  if (keys.length === 1) return `${name}: ${firstKey} changed from ${a} → ${b}.`;
  return `${name}: ${keys.length} attribute(s) differ — including ${firstKey} (${a} → ${b}).`;
}

function keyOf(r: { resourceKind: ResourceKind; resourceId: string }): string {
  return `${r.resourceKind}::${r.resourceId}`;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as Record<string, unknown>).sort();
    const bKeys = Object.keys(b as Record<string, unknown>).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) if (aKeys[i] !== bKeys[i]) return false;
    for (const k of aKeys) {
      if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
    }
    return true;
  }
  return false;
}
