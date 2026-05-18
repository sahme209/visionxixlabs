/**
 * Integration Health — typed contract.
 *
 * Composes the same canonical signals AxiomOSState reports (provider
 * postures, operating loops, desktop posture, audit/memory persistence,
 * evidence coverage) into a per-integration health row an operator can
 * scan at a glance.
 *
 * Pure types. The builder lives in integrationHealthChecker.ts and is
 * server-only. No SDK calls, no SDK objects ever returned.
 */

export type IntegrationKind =
  | "aws"
  | "azure"
  | "gcp"
  | "github"
  | "desktop"
  | "trust_evidence"
  | "audit_persistence"
  | "memory_persistence";

export type IntegrationHealthStatus =
  | "healthy"
  | "degraded"
  | "preview"
  | "blocked"
  | "disabled"
  | "unknown";

export type IntegrationHealthSourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "foundation"
  | "planned"
  | "disabled"
  | "blocked"
  | "unknown";

/** One row the UI / API surfaces. */
export interface IntegrationHealthEntry {
  /** Stable id for keying + filtering. */
  id: IntegrationKind;
  /** Human label. */
  label: string;
  /** Tone-coded status. */
  status: IntegrationHealthStatus;
  /** Honest sourceMode of the underlying signal. */
  sourceMode: IntegrationHealthSourceMode;
  /** One-line operator-facing headline. */
  headline: string;
  /** When the underlying canonical state was last computed. Always present. */
  lastCheckedAt: string;
  /** Last successful canonical sync (when known). */
  lastSuccessAt?: string;
  /** Most recent failure (when known). */
  lastFailureAt?: string;
  /** Concise reason for non-healthy state. */
  failureReason?: string;
  /** Env vars / secrets / config still missing. */
  missingConfig: string[];
  /** Permissions / scopes not yet granted. */
  missingPermissions: string[];
  /** Honest in-product limitations. */
  limitations: string[];
  /** Safe next action the operator can click. */
  safeNextAction?: { label: string; href: string };
  /** Where setup docs live for this integration. */
  setupRoute?: string;
  /** Stable evidence ids the operator can verify against. */
  evidenceRefs: string[];
}

/** Composite shape returned by /api/integrations/health. */
export interface IntegrationHealthReport {
  generatedAt: string;
  tenantId?: string;
  /** Rolled-up status across all entries (worst-wins). */
  overallStatus: IntegrationHealthStatus;
  /** Rolled-up sourceMode (most-conservative). */
  overallSourceMode: IntegrationHealthSourceMode;
  entries: IntegrationHealthEntry[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    preview: number;
    blocked: number;
    disabled: number;
  };
  /** Workspace-level limitations operators should know. */
  limitations: string[];
  /** Where to go next from the aggregator view. */
  safeNextAction: { label: string; href: string };
}

/** Worst-wins rollup helper for the composite status field. */
export function rollupHealthStatus(entries: IntegrationHealthEntry[]): IntegrationHealthStatus {
  if (entries.length === 0) return "unknown";
  if (entries.some((e) => e.status === "blocked"))  return "blocked";
  if (entries.some((e) => e.status === "degraded")) return "degraded";
  if (entries.some((e) => e.status === "preview"))  return "preview";
  if (entries.some((e) => e.status === "disabled")) return "disabled";
  if (entries.every((e) => e.status === "healthy")) return "healthy";
  return "unknown";
}

/** Most-conservative sourceMode rollup. */
export function rollupHealthSourceMode(entries: IntegrationHealthEntry[]): IntegrationHealthSourceMode {
  if (entries.length === 0) return "unknown";
  if (entries.some((e) => e.sourceMode === "blocked"))      return "blocked";
  if (entries.some((e) => e.sourceMode === "disabled"))     return "disabled";
  if (entries.some((e) => e.sourceMode === "preview"))      return "preview";
  if (entries.some((e) => e.sourceMode === "foundation"))   return "foundation";
  if (entries.some((e) => e.sourceMode === "planned"))      return "planned";
  if (entries.some((e) => e.sourceMode === "partial_live")) return "partial_live";
  if (entries.every((e) => e.sourceMode === "live"))        return "live";
  return "unknown";
}

/** Status-to-tone for UI consistency. */
export const STATUS_TONE: Record<IntegrationHealthStatus, "emerald" | "cyan" | "amber" | "rose" | "zinc"> = {
  healthy:  "emerald",
  preview:  "amber",
  degraded: "amber",
  blocked:  "rose",
  disabled: "zinc",
  unknown:  "zinc",
};

export const KIND_LABEL: Record<IntegrationKind, string> = {
  aws:                "AWS",
  azure:              "Azure",
  gcp:                "GCP",
  github:             "GitHub",
  desktop:            "Desktop runtime",
  trust_evidence:     "Trust evidence",
  audit_persistence:  "Audit log",
  memory_persistence: "Operational memory",
};
