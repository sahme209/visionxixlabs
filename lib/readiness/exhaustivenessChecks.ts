/**
 * Exhaustiveness self-tests.
 *
 * Catches the class of bugs the last four fix-up commits all shared:
 * extending a union type (SecurityCheckCategory / SecurityCheckScope /
 * etc.) without updating every `Record<EnumType, T>` / switch lookup
 * downstream.
 *
 * TypeScript's `Record<EnumType, T>` catches this at compile time *only
 * if* every consumer is statically typed against the source union. The
 * runtime checks here back-stop the compiler so vitest fails fast
 * on cascade gaps.
 */

import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type SecurityCheckCategory,
  type SecurityCheckScope,
  type SecurityCheckSeverity,
  type SecurityCheckStatus,
} from "../securityScanner/securityScanner";

export type ExhaustivenessResult =
  | { ok: true; recordName: string; size: number }
  | { ok: false; recordName: string; missing: string[]; extra: string[] };

/**
 * Generic exhaustiveness check — confirms every member of `expected` exists
 * as a key in `record`, and that `record` has no extra keys.
 */
function checkExhaustive<T extends string>(
  recordName: string,
  expected: readonly T[],
  record: Record<string, unknown>,
): ExhaustivenessResult {
  const recordKeys = new Set(Object.keys(record));
  const expectedSet = new Set<string>(expected);
  const missing = expected.filter((k) => !recordKeys.has(k));
  const extra = [...recordKeys].filter((k) => !expectedSet.has(k));
  if (missing.length === 0 && extra.length === 0) {
    return { ok: true, recordName, size: recordKeys.size };
  }
  return { ok: false, recordName, missing, extra };
}

// ---------------------------------------------------------------------------
// The canonical enum value lists — keep these in lock-step with the union
// types they mirror. The vitest test confirms every Record<UnionType, T> in
// the codebase contains exactly these keys.
// ---------------------------------------------------------------------------

export const SECURITY_CHECK_CATEGORIES: readonly SecurityCheckCategory[] = [
  "cloud_misconfig",
  "iam_overreach",
  "network_exposure",
  "encryption_at_rest",
  "backup_resilience",
  "single_region",
  "supply_chain",
  "app_boundary",
  "secret_handling",
  "audit_gap",
  "desktop_distribution",
  "desktop_execution",
  "release_governance",
  "pipeline_health",
] as const;

export const SECURITY_CHECK_SCOPES: readonly SecurityCheckScope[] = [
  "cloud",
  "app",
  "supply_chain",
  "desktop",
  "github",
] as const;

export const SECURITY_CHECK_SEVERITIES: readonly SecurityCheckSeverity[] = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const SECURITY_CHECK_STATUSES: readonly SecurityCheckStatus[] = [
  "pass",
  "fail",
  "warn",
  "unknown",
  "preview",
] as const;

// ---------------------------------------------------------------------------
// Runtime exhaustiveness audit — entry point used by tests + runner
// ---------------------------------------------------------------------------

export function auditAllExhaustiveness(): ExhaustivenessResult[] {
  return [
    checkExhaustive("CATEGORY_LABEL", SECURITY_CHECK_CATEGORIES, CATEGORY_LABEL as Record<string, unknown>),
    checkExhaustive("SEVERITY_LABEL", SECURITY_CHECK_SEVERITIES, SEVERITY_LABEL as Record<string, unknown>),
    checkExhaustive("STATUS_LABEL",   SECURITY_CHECK_STATUSES,   STATUS_LABEL   as Record<string, unknown>),
  ];
}
