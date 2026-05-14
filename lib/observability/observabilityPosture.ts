/**
 * Observability posture aggregator — pure function over the metrics
 * snapshots + trace counters. Powers the Trace Viewer headline + the
 * Command Center observability strip.
 */

import type { DataSource } from "@/lib/domain/source";
import { readAll } from "./metrics";
import type { CounterSnapshot } from "./metrics";
import type { OrganizationId } from "@/lib/domain/ids";

export type ObservabilitySemantic = "neutral" | "success" | "warning" | "error";

export interface ObservabilityCheck {
  id: string;
  label: string;
  detail: string;
  semantic: ObservabilitySemantic;
}

export interface ObservabilityPosture {
  source: DataSource;
  /** Total trace counters captured. */
  metricsRecorded: number;
  /** Number of distinct metric ids that have at least one observation. */
  distinctMetricsObserved: number;
  /** Headline check rows for the UI strip. */
  checks: ObservabilityCheck[];
  /** All counter snapshots grouped by domain prefix. */
  countersByGroup: Record<string, CounterSnapshot[]>;
}

export interface PostureInputs {
  source: DataSource;
  organizationId?: OrganizationId;
  /** Total traces captured in the last 24h. */
  traces24h: number;
  /** Audit records written in the last 24h. */
  auditRecords24h: number;
  /** Bundles exported in the last 30d. */
  bundlesExported30d: number;
  /** Whether the structured logger is wired and emitting redacted JSON. */
  loggerActive: boolean;
  /** Whether the audit store is configured. */
  auditStoreConfigured: boolean;
  /** Whether copilot interactions are being audited. */
  copilotAuditActive: boolean;
}

export function buildObservabilityPosture(input: PostureInputs): ObservabilityPosture {
  const snapshots = readAll(input.organizationId);
  const observed = snapshots.filter((s) => s.value > 0);
  const groups: Record<string, CounterSnapshot[]> = {};
  for (const snap of snapshots) {
    const prefix = snap.metric.split(".")[0];
    (groups[prefix] ?? (groups[prefix] = [])).push(snap);
  }

  const checks: ObservabilityCheck[] = [
    {
      id: "logger.active",
      label: "Structured logging",
      detail: input.loggerActive
        ? "JSON logs flowing through canonical redaction before emit."
        : "Structured logger not active — falling back to raw console output.",
      semantic: input.loggerActive ? "success" : "error",
    },
    {
      id: "audit.store",
      label: "Audit store",
      detail: input.auditStoreConfigured
        ? "Audit store configured. Sensitive actions are persisted with correlation IDs."
        : "Audit store not configured — actions are not durably recorded.",
      semantic: input.auditStoreConfigured ? "success" : "error",
    },
    {
      id: "traces.recent",
      label: "Operation traces",
      detail: input.traces24h === 0
        ? "No traces captured in the last 24h."
        : `${input.traces24h} operation trace(s) captured in the last 24h.`,
      semantic: input.traces24h > 0 ? "success" : "neutral",
    },
    {
      id: "audit.records",
      label: "Audit records",
      detail: input.auditRecords24h === 0
        ? "No audit records written in the last 24h."
        : `${input.auditRecords24h} audit record(s) in the last 24h across the canonical taxonomy.`,
      semantic: input.auditRecords24h > 0 ? "success" : "neutral",
    },
    {
      id: "audit.bundles",
      label: "Bundle exports",
      detail: input.bundlesExported30d === 0
        ? "No audit bundles exported in the last 30d — bundle engine ready when reviewers ask."
        : `${input.bundlesExported30d} bundle(s) exported in the last 30d (JSON / CSV / NDJSON).`,
      semantic: "success",
    },
    {
      id: "copilot.audit",
      label: "Copilot auditability",
      detail: input.copilotAuditActive
        ? "Every copilot query and response is audited with evidence + safety notes."
        : "Copilot interactions are not auditable — install the copilot audit hook.",
      semantic: input.copilotAuditActive ? "success" : "warning",
    },
  ];

  return {
    source: input.source,
    metricsRecorded: snapshots.reduce((s, x) => s + x.value, 0),
    distinctMetricsObserved: observed.length,
    checks,
    countersByGroup: groups,
  };
}
