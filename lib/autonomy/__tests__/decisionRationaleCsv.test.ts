/**
 * Vitest unit tests for the decision rationale CSV exporter.
 *
 * Locks in RFC 4180 quoting, CRLF line endings, stable column
 * order, and that embedded commas / quotes / newlines never break
 * downstream spreadsheet ingestion.
 */

import { describe, it, expect } from "vitest";
import { buildRationaleCsv, type RationaleCsvRow } from "../decisionRationaleCsv";

const SAMPLE: RationaleCsvRow = {
  id: "row-1",
  candidateId: "cand-1",
  title: "Audit findings sweep",
  charterMode: "review",
  boundaryClass: "approval_required",
  outcome: "approval_packet_prepared",
  haltedAtStage: null,
  haltReason: null,
  proposedIntent: "Stage GuardDuty severity-high findings for review.",
  durationMs: 2451,
  evidenceRefs: ["risk:42", "cloudtrail:event:abc"],
  createdAt: "2026-05-19T17:00:00.000Z",
};

describe("decision rationale CSV", () => {
  it("emits a header row followed by data rows with CRLF terminators", () => {
    const csv = buildRationaleCsv([SAMPLE]);
    expect(csv.endsWith("\r\n")).toBe(true);
    const lines = csv.split("\r\n");
    // Header + 1 row + trailing empty (after the final CRLF).
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe(
      '"id","candidate_id","title","charter_mode","boundary_class","outcome","halted_at_stage","halt_reason","proposed_intent","duration_ms","evidence_refs","created_at"',
    );
  });

  it("quotes every field, even safe ones, for deterministic parsing", () => {
    const csv = buildRationaleCsv([SAMPLE]);
    const dataLine = csv.split("\r\n")[1];
    // 12 columns → 12 quote pairs → 24 double-quote characters.
    expect(dataLine.split('"').length - 1).toBe(24);
  });

  it("escapes embedded double quotes per RFC 4180", () => {
    const row: RationaleCsvRow = {
      ...SAMPLE,
      title: `He said "deny it" and walked away`,
    };
    const csv = buildRationaleCsv([row]);
    expect(csv).toContain(`"He said ""deny it"" and walked away"`);
  });

  it("preserves embedded commas + newlines inside quoted fields", () => {
    const row: RationaleCsvRow = {
      ...SAMPLE,
      proposedIntent: "Line one,\nLine two with a , comma",
    };
    const csv = buildRationaleCsv([row]);
    expect(csv).toContain(`"Line one,\nLine two with a , comma"`);
  });

  it("joins evidence refs with ' | ' separator inside a single field", () => {
    const csv = buildRationaleCsv([SAMPLE]);
    expect(csv).toContain(`"risk:42 | cloudtrail:event:abc"`);
  });

  it("emits empty quoted strings for null haltedAtStage / haltReason", () => {
    const csv = buildRationaleCsv([SAMPLE]);
    // 7th + 8th columns are halted_at_stage + halt_reason — both should
    // render as two adjacent empty quoted strings.
    expect(csv).toContain(`"approval_packet_prepared","",""`);
  });

  it("emits header-only output when given an empty row list", () => {
    const csv = buildRationaleCsv([]);
    expect(csv.split("\r\n").length).toBe(2);
    expect(csv.split("\r\n")[0]).toMatch(/^"id"/);
  });
});
