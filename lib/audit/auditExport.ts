/**
 * Enterprise audit export — typed export of the immutable audit trail.
 *
 * Supports filtering, format choice (CSV / JSON / NDJSON), and bundled
 * exports per execution plan / connector / ReleaseOps release. Tenant
 * isolation enforced by the caller — this module is pure formatting.
 */

import type { MemoryRecord } from "@/lib/memory/operationalMemory";

// ---------------------------------------------------------------------------
// Filter + format
// ---------------------------------------------------------------------------

export type ExportFormat = "csv" | "json" | "ndjson";

export type BundleKind =
  | "all"
  | "execution_plan"
  | "connector"
  | "release"
  | "policy_decision"
  | "desktop_execution";

export interface ExportFilter {
  organizationId: string;
  bundleKind: BundleKind;
  /** Filter to a specific entity ID when bundleKind requires it. */
  entityId?: string;
  sinceISO?: string;
  untilISO?: string;
  /** Event kinds to include — empty array means all. */
  kinds?: string[];
}

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  bytes: number;
  recordsExported: number;
  /** The actual content. */
  content: string;
  /** Honest metadata — tenant, window, filter, generator. */
  metadata: {
    organizationId: string;
    windowStart?: string;
    windowEnd?: string;
    bundleKind: BundleKind;
    generatedAt: string;
  };
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

/**
 * Convert MemoryRecord[] into the requested export format. Pure function —
 * no I/O. Tenant filtering happens upstream.
 */
export function exportRecords(records: MemoryRecord[], format: ExportFormat, filter: ExportFilter): ExportResult {
  const filtered = applyFilter(records, filter);
  const generatedAt = new Date().toISOString();

  let content: string;
  let filename: string;

  switch (format) {
    case "csv":
      content = toCsv(filtered);
      filename = buildFilename(filter, "csv");
      break;
    case "json":
      content = JSON.stringify({
        metadata: {
          organizationId: filter.organizationId,
          windowStart: filter.sinceISO,
          windowEnd: filter.untilISO,
          bundleKind: filter.bundleKind,
          generatedAt,
        },
        records: filtered,
      }, null, 2);
      filename = buildFilename(filter, "json");
      break;
    case "ndjson":
      content = filtered.map((r) => JSON.stringify(r)).join("\n");
      filename = buildFilename(filter, "ndjson");
      break;
  }

  return {
    format,
    filename,
    bytes: content.length,
    recordsExported: filtered.length,
    content,
    metadata: {
      organizationId: filter.organizationId,
      windowStart: filter.sinceISO,
      windowEnd: filter.untilISO,
      bundleKind: filter.bundleKind,
      generatedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function applyFilter(records: MemoryRecord[], filter: ExportFilter): MemoryRecord[] {
  let out = records.filter((r) => r.organizationId === filter.organizationId);
  if (filter.sinceISO) out = out.filter((r) => r.occurredAt >= filter.sinceISO!);
  if (filter.untilISO) out = out.filter((r) => r.occurredAt <= filter.untilISO!);
  if (filter.kinds && filter.kinds.length > 0) {
    const set = new Set(filter.kinds);
    out = out.filter((r) => set.has(r.kind));
  }

  if (filter.bundleKind === "execution_plan" && filter.entityId) {
    out = out.filter((r) => r.links.executionPlanIds?.includes(filter.entityId!));
  } else if (filter.bundleKind === "release" && filter.entityId) {
    out = out.filter((r) => r.summary.toLowerCase().includes(filter.entityId!.toLowerCase()));
  } else if (filter.bundleKind === "policy_decision") {
    out = out.filter((r) => r.evidence.some((e) => e.name === "policy_decision"));
  } else if (filter.bundleKind === "desktop_execution") {
    out = out.filter((r) => r.kind === "desktop.local_execution" || r.kind === "desktop.handoff_delivered");
  } else if (filter.bundleKind === "connector" && filter.entityId) {
    out = out.filter((r) => r.evidence.some((e) => e.name === "connector_id" && e.value === filter.entityId));
  }

  out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return out;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function toCsv(records: MemoryRecord[]): string {
  const header = ["id", "occurredAt", "kind", "actorId", "provider", "summary", "outcome", "costDeltaUsd", "confidenceDelta", "riskDelta", "resourceIds", "linkedAuditEvents", "linkedPlans", "linkedRecommendations"];
  const lines: string[] = [header.join(",")];
  for (const r of records) {
    lines.push([
      csvEscape(r.id),
      csvEscape(r.occurredAt),
      csvEscape(r.kind),
      csvEscape(r.actorId),
      csvEscape(r.provider ?? ""),
      csvEscape(r.summary),
      csvEscape(r.outcome),
      csvEscape(r.impact.costDeltaUsd ?? ""),
      csvEscape(r.impact.confidenceDelta ?? ""),
      csvEscape(r.impact.riskDelta ?? ""),
      csvEscape(r.resources.map((res) => res.id).join("|")),
      csvEscape((r.links.auditEventIds ?? []).join("|")),
      csvEscape((r.links.executionPlanIds ?? []).join("|")),
      csvEscape((r.links.recommendationIds ?? []).join("|")),
    ].join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------------------------------------------------------------------------
// Filename builder
// ---------------------------------------------------------------------------

function buildFilename(filter: ExportFilter, ext: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const bundle = filter.bundleKind.replace(/_/g, "-");
  const entity = filter.entityId ? `_${filter.entityId.slice(0, 20)}` : "";
  return `axiom_audit_${bundle}${entity}_${date}.${ext}`;
}

// ---------------------------------------------------------------------------
// SIEM webhook delivery — outbound integration stub
// ---------------------------------------------------------------------------

export interface SiemWebhookDelivery {
  endpoint: string;
  /** Outbound payload format expected by the SIEM. */
  format: "ndjson" | "splunk_hec" | "datadog_logs";
  /** HMAC signing secret reference (stored in tenant keychain). */
  signingSecretRef?: string;
}

export interface DeliveryResult {
  delivered: boolean;
  recordsDelivered: number;
  bytes: number;
  error?: string;
}

/**
 * Prepare a webhook delivery for SIEM ingestion. Returns a typed payload —
 * does not perform the HTTP call. The caller performs the request with
 * appropriate retry logic and HMAC signing.
 */
export function preparedSiemPayload(records: MemoryRecord[], delivery: SiemWebhookDelivery): { payload: string; recordsCount: number } {
  switch (delivery.format) {
    case "ndjson":
      return { payload: records.map((r) => JSON.stringify(r)).join("\n"), recordsCount: records.length };
    case "splunk_hec":
      return {
        payload: records.map((r) => JSON.stringify({ event: r, sourcetype: "axiom_audit", source: "axiom-agent" })).join("\n"),
        recordsCount: records.length,
      };
    case "datadog_logs":
      return {
        payload: JSON.stringify(records.map((r) => ({ message: r.summary, service: "axiom-agent", ddsource: "axiom_audit", attributes: r }))),
        recordsCount: records.length,
      };
  }
}
