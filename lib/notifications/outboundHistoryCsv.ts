/**
 * Outbound notification history CSV exporter.
 *
 * Pure-function RFC 4180 builder matching the rationale + telemetry
 * CSV invariants (CRLF, every field quoted, internal `""` escape).
 * Each row is one OutboundNotificationRecord — what was sent, when,
 * to which channels, with what outcome.
 *
 * 11-column stable layout suitable for incident timelines and
 * compliance review packets.
 */

export interface OutboundCsvRow {
  id: string;
  dedupeKey: string;
  kind: string;
  severity: string;
  outcome: string;
  headline: string;
  channelsSucceeded: string[];
  channelsSkipped: string[];
  evidenceRefs: string[];
  correlationId: string | null;
  createdAt: string;
}

const COLUMNS: Array<{ header: string; pick: (r: OutboundCsvRow) => string }> = [
  { header: "id",                 pick: (r) => r.id },
  { header: "dedupe_key",         pick: (r) => r.dedupeKey },
  { header: "kind",               pick: (r) => r.kind },
  { header: "severity",           pick: (r) => r.severity },
  { header: "outcome",            pick: (r) => r.outcome },
  { header: "headline",           pick: (r) => r.headline },
  { header: "channels_succeeded", pick: (r) => r.channelsSucceeded.join(" | ") },
  { header: "channels_skipped",   pick: (r) => r.channelsSkipped.join(" | ") },
  { header: "evidence_refs",      pick: (r) => r.evidenceRefs.join(" | ") },
  { header: "correlation_id",     pick: (r) => r.correlationId ?? "" },
  { header: "created_at",         pick: (r) => r.createdAt },
];

export function buildOutboundHistoryCsv(rows: OutboundCsvRow[]): string {
  const lines: string[] = [];
  lines.push(COLUMNS.map((c) => quote(c.header)).join(","));
  for (const r of rows) {
    lines.push(COLUMNS.map((c) => quote(c.pick(r))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
