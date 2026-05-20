/**
 * Vitest unit tests for the telemetry signal CSV exporter.
 *
 * Mirrors the rationale CSV invariants: header + CRLF, every field
 * quoted, RFC 4180 quote escaping, embedded commas + newlines
 * preserved, stable 10-column order, confidence formatted to 3
 * decimals, header-only output for empty input.
 */

import { describe, it, expect } from "vitest";
import { buildTelemetrySignalCsv } from "../telemetrySignalCsv";
import type { TelemetrySignal } from "../telemetryIngestModel";

const SAMPLE: TelemetrySignal = {
  id: "datadog:1234",
  kind: "alert_firing",
  severity: "high",
  scope: "service:checkout",
  headline: "Checkout error rate above 5%",
  detail: "Sustained 5xx over the last 10 minutes",
  firedAt: "2026-05-19T18:00:00.000Z",
  sourceProvider: "datadog",
  evidenceRef: "https://app.datadoghq.com/monitors/1234",
  sourceMode: "live",
  confidence: 0.92,
  safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
};

describe("telemetry signal CSV", () => {
  it("emits header + data rows with CRLF terminators", () => {
    const csv = buildTelemetrySignalCsv([SAMPLE]);
    expect(csv.endsWith("\r\n")).toBe(true);
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(3); // header + 1 row + trailing empty
  });

  it("emits a stable 10-column header", () => {
    const csv = buildTelemetrySignalCsv([SAMPLE]);
    const header = csv.split("\r\n")[0];
    expect(header).toBe(
      '"id","kind","severity","source_provider","scope","headline","detail","fired_at","confidence","evidence_ref"',
    );
  });

  it("quotes every field, even safe ones", () => {
    const csv = buildTelemetrySignalCsv([SAMPLE]);
    const dataLine = csv.split("\r\n")[1];
    // 10 columns → 20 double-quote characters.
    expect(dataLine.split('"').length - 1).toBe(20);
  });

  it("escapes embedded double quotes per RFC 4180", () => {
    const sig: TelemetrySignal = {
      ...SAMPLE,
      headline: `Service "checkout" misbehaving`,
    };
    const csv = buildTelemetrySignalCsv([sig]);
    expect(csv).toContain(`"Service ""checkout"" misbehaving"`);
  });

  it("preserves embedded commas and newlines inside quoted fields", () => {
    const sig: TelemetrySignal = {
      ...SAMPLE,
      detail: "Error rate 5%,\nLatency p95 1200ms",
    };
    const csv = buildTelemetrySignalCsv([sig]);
    expect(csv).toContain(`"Error rate 5%,\nLatency p95 1200ms"`);
  });

  it("formats confidence to 3 decimal places", () => {
    const sig: TelemetrySignal = { ...SAMPLE, confidence: 0.1 };
    const csv = buildTelemetrySignalCsv([sig]);
    expect(csv).toContain('"0.100"');
  });

  it("emits header-only output for an empty signal list", () => {
    const csv = buildTelemetrySignalCsv([]);
    expect(csv.split("\r\n").length).toBe(2); // header + trailing empty
  });
});
