/**
 * Telemetry signal CSV exporter.
 *
 * Pure-function CSV builder for TelemetrySignal rows. Parity with
 * the decision-rationale CSV: RFC 4180 quoting, CRLF terminators,
 * stable column order.
 *
 * Hard rules:
 *   - Pure: no fetch, no DB. Caller feeds in signals.
 *   - Every field quoted; embedded `"` becomes `""`; embedded
 *     commas + newlines preserved inside quotes.
 *   - 10 columns, stable order.
 */

import type { TelemetrySignal } from "./telemetryIngestModel";

const COLUMNS: Array<{ header: string; pick: (s: TelemetrySignal) => string }> = [
  { header: "id",               pick: (s) => s.id },
  { header: "kind",             pick: (s) => s.kind },
  { header: "severity",         pick: (s) => s.severity },
  { header: "source_provider",  pick: (s) => s.sourceProvider },
  { header: "scope",            pick: (s) => s.scope },
  { header: "headline",         pick: (s) => s.headline },
  { header: "detail",           pick: (s) => s.detail },
  { header: "fired_at",         pick: (s) => s.firedAt },
  { header: "confidence",       pick: (s) => s.confidence.toFixed(3) },
  { header: "evidence_ref",     pick: (s) => s.evidenceRef },
];

export function buildTelemetrySignalCsv(signals: TelemetrySignal[]): string {
  const lines: string[] = [];
  lines.push(COLUMNS.map((c) => quote(c.header)).join(","));
  for (const s of signals) {
    lines.push(COLUMNS.map((c) => quote(c.pick(s))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
