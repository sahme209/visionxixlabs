/**
 * Vitest unit tests for the pure outbound-digest builder.
 */

import { describe, it, expect } from "vitest";
import { buildOutboundDigest, type RawOutboundRow } from "../outboundDigestBuilder";

const ROW = (overrides: Partial<RawOutboundRow> = {}): RawOutboundRow => ({
  kind: "approval_packet_ready",
  severity: "high",
  outcome: "ok",
  dedupeKey: "k-1",
  correlationId: "c-1",
  createdAt: "2026-05-20T01:00:00.000Z",
  ...overrides,
});

describe("outboundDigestBuilder", () => {
  it("empty input → zero totals", () => {
    const r = buildOutboundDigest([]);
    expect(r.totalEvents).toBe(0);
    expect(r.windowStart).toBeNull();
    expect(r.windowEnd).toBeNull();
    expect(r.outcomes).toEqual({ ok: 0, failed: 0, skipped: 0 });
  });

  it("counts outcomes correctly", () => {
    const r = buildOutboundDigest([
      ROW({ outcome: "ok" }),
      ROW({ outcome: "failed" }),
      ROW({ outcome: "failed" }),
      ROW({ outcome: "skipped" }),
    ]);
    expect(r.outcomes).toEqual({ ok: 1, failed: 2, skipped: 1 });
  });

  it("counts by kind and tracks failed-per-kind", () => {
    const r = buildOutboundDigest([
      ROW({ kind: "approval_packet_ready", outcome: "ok" }),
      ROW({ kind: "approval_packet_ready", outcome: "failed" }),
      ROW({ kind: "incident_signal",       outcome: "ok" }),
    ]);
    const a = r.byKind.find((k) => k.kind === "approval_packet_ready")!;
    const b = r.byKind.find((k) => k.kind === "incident_signal")!;
    expect(a.count).toBe(2);
    expect(a.failed).toBe(1);
    expect(b.count).toBe(1);
    expect(b.failed).toBe(0);
  });

  it("counts by severity", () => {
    const r = buildOutboundDigest([
      ROW({ severity: "high" }),
      ROW({ severity: "high" }),
      ROW({ severity: "low" }),
    ]);
    expect(r.bySeverity.find((s) => s.severity === "high")!.count).toBe(2);
    expect(r.bySeverity.find((s) => s.severity === "low")!.count).toBe(1);
  });

  it("tops dedupe groups by count, capped at 10", () => {
    const rows: RawOutboundRow[] = [];
    for (let i = 0; i < 15; i++) rows.push(ROW({ dedupeKey: `k-${i}` }));
    for (let i = 0; i < 5; i++) rows.push(ROW({ dedupeKey: "k-hot" }));
    const r = buildOutboundDigest(rows);
    expect(r.topDedupeGroups.length).toBe(10);
    expect(r.topDedupeGroups[0].dedupeKey).toBe("k-hot");
    expect(r.topDedupeGroups[0].count).toBe(5);
  });

  it("skips null correlationIds in top list", () => {
    const r = buildOutboundDigest([
      ROW({ correlationId: null }),
      ROW({ correlationId: "c-1" }),
      ROW({ correlationId: "c-1" }),
    ]);
    expect(r.topCorrelationIds.length).toBe(1);
    expect(r.topCorrelationIds[0].correlationId).toBe("c-1");
    expect(r.topCorrelationIds[0].count).toBe(2);
  });

  it("tracks earliest and latest createdAt", () => {
    const r = buildOutboundDigest([
      ROW({ createdAt: "2026-05-20T05:00:00.000Z" }),
      ROW({ createdAt: "2026-05-20T01:00:00.000Z" }),
      ROW({ createdAt: "2026-05-20T03:00:00.000Z" }),
    ]);
    expect(r.windowStart).toBe("2026-05-20T01:00:00.000Z");
    expect(r.windowEnd).toBe("2026-05-20T05:00:00.000Z");
  });
});
