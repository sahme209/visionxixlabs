/**
 * Vitest unit tests for the outbound history CSV exporter.
 *
 * Mirrors the rationale + telemetry CSV invariants: header + CRLF,
 * every field quoted, RFC 4180 escaping, embedded commas + newlines
 * preserved, evidence/channel arrays joined with " | ", stable
 * 11-column order.
 */

import { describe, it, expect } from "vitest";
import { buildOutboundHistoryCsv, type OutboundCsvRow } from "../outboundHistoryCsv";

const SAMPLE: OutboundCsvRow = {
  id: "rec-1",
  dedupeKey: "autonomy:approval:cand-7",
  kind: "approval_packet_ready",
  severity: "high",
  outcome: "ok",
  headline: "Approval packet ready: Tighten S3 PAB",
  channelsSucceeded: ["slack"],
  channelsSkipped: ["microsoft_teams:TEAMS_WEBHOOK_URL not set"],
  evidenceRefs: ["risk:42", "cloudtrail:event:abc"],
  correlationId: "req-correlation-abc",
  createdAt: "2026-05-20T01:23:45.000Z",
};

describe("outbound history CSV", () => {
  it("emits header + 1 data row + trailing CRLF", () => {
    const csv = buildOutboundHistoryCsv([SAMPLE]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n").length).toBe(3);
  });

  it("emits the canonical 11-column header", () => {
    const csv = buildOutboundHistoryCsv([SAMPLE]);
    const header = csv.split("\r\n")[0];
    expect(header).toBe(
      '"id","dedupe_key","kind","severity","outcome","headline","channels_succeeded","channels_skipped","evidence_refs","correlation_id","created_at"',
    );
  });

  it("quotes every field", () => {
    const csv = buildOutboundHistoryCsv([SAMPLE]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine.split('"').length - 1).toBe(22); // 11 fields × 2 quote chars
  });

  it("escapes embedded double quotes", () => {
    const row: OutboundCsvRow = { ...SAMPLE, headline: 'Cluster "prod-1" degraded' };
    const csv = buildOutboundHistoryCsv([row]);
    expect(csv).toContain('"Cluster ""prod-1"" degraded"');
  });

  it("preserves embedded commas + newlines inside quoted fields", () => {
    const row: OutboundCsvRow = { ...SAMPLE, headline: "Line one,\nLine two with a , comma" };
    const csv = buildOutboundHistoryCsv([row]);
    expect(csv).toContain('"Line one,\nLine two with a , comma"');
  });

  it("joins channels + evidence arrays with ' | '", () => {
    const row: OutboundCsvRow = {
      ...SAMPLE,
      channelsSucceeded: ["slack", "microsoft_teams"],
      evidenceRefs: ["a", "b", "c"],
    };
    const csv = buildOutboundHistoryCsv([row]);
    expect(csv).toContain('"slack | microsoft_teams"');
    expect(csv).toContain('"a | b | c"');
  });

  it("renders null correlationId as an empty quoted string", () => {
    const row: OutboundCsvRow = { ...SAMPLE, correlationId: null };
    const csv = buildOutboundHistoryCsv([row]);
    // 10th column is correlation_id; should be `,""` followed by created_at.
    expect(csv).toContain('"",');
  });

  it("emits header-only output for an empty input", () => {
    const csv = buildOutboundHistoryCsv([]);
    expect(csv.split("\r\n").length).toBe(2);
  });
});
