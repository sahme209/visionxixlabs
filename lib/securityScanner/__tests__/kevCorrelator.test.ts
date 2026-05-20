/**
 * Vitest unit tests for the pure KEV correlator.
 */

import { describe, it, expect } from "vitest";
import { correlateKev, type DetectedCve, type KevEntry } from "../kevCorrelator";

const KEV = (cve: string, dueDate: string): KevEntry => ({
  cveId: cve, dateAdded: "2026-01-01T00:00:00.000Z", dueDate, shortDescription: "test entry",
});
const DET = (cve: string, resourceId: string, service = "checkout"): DetectedCve =>
  ({ cveId: cve, resourceId, service });

const NOW = "2026-05-20T00:00:00.000Z";

describe("kevCorrelator", () => {
  it("empty detections → empty report", () => {
    const r = correlateKev({ detections: [], kevCatalog: [], now: NOW });
    expect(r.matchedCount).toBe(0);
    expect(r.unmatchedDetections.length).toBe(0);
  });

  it("matches detection to KEV catalog entry", () => {
    const r = correlateKev({
      detections: [DET("CVE-2026-1234", "r-1")],
      kevCatalog: [KEV("CVE-2026-1234", "2026-06-01T00:00:00.000Z")],
      now: NOW,
    });
    expect(r.matchedCount).toBe(1);
    expect(r.rows[0].pastDue).toBe(false);
  });

  it("unmatched detections surface separately", () => {
    const r = correlateKev({
      detections: [DET("CVE-2026-9999", "r-1")],
      kevCatalog: [KEV("CVE-2026-1234", "2026-06-01T00:00:00.000Z")],
      now: NOW,
    });
    expect(r.matchedCount).toBe(0);
    expect(r.unmatchedDetections.length).toBe(1);
  });

  it("flags pastDue when KEV dueDate < now", () => {
    const r = correlateKev({
      detections: [DET("CVE-2026-1234", "r-1")],
      kevCatalog: [KEV("CVE-2026-1234", "2026-04-01T00:00:00.000Z")],
      now: NOW,
    });
    expect(r.rows[0].pastDue).toBe(true);
    expect(r.rows[0].severity).toBe("critical");
  });

  it("deduplicates resource ids per CVE", () => {
    const r = correlateKev({
      detections: [DET("CVE-2026-1234", "r-1"), DET("CVE-2026-1234", "r-1"), DET("CVE-2026-1234", "r-2")],
      kevCatalog: [KEV("CVE-2026-1234", "2026-06-01T00:00:00.000Z")],
      now: NOW,
    });
    expect(r.rows[0].affectedResourceIds).toEqual(["r-1", "r-2"]);
    expect(r.rows[0].affectedCount).toBe(2);
  });

  it("severity ladder: pastDue → critical; count>=5 → high; >=2 → medium; <2 → low", () => {
    const kev = [KEV("CVE-2026-A", "2026-06-01T00:00:00.000Z")];
    const oneRes = correlateKev({ detections: [DET("CVE-2026-A", "r-1")], kevCatalog: kev, now: NOW }).rows[0];
    const twoRes = correlateKev({
      detections: [DET("CVE-2026-A", "r-1"), DET("CVE-2026-A", "r-2")],
      kevCatalog: kev, now: NOW,
    }).rows[0];
    const fiveRes = correlateKev({
      detections: [
        DET("CVE-2026-A", "r-1"), DET("CVE-2026-A", "r-2"), DET("CVE-2026-A", "r-3"),
        DET("CVE-2026-A", "r-4"), DET("CVE-2026-A", "r-5"),
      ],
      kevCatalog: kev, now: NOW,
    }).rows[0];
    expect(oneRes.severity).toBe("low");
    expect(twoRes.severity).toBe("medium");
    expect(fiveRes.severity).toBe("high");
  });

  it("sorts rows by severity then affectedCount desc", () => {
    const r = correlateKev({
      detections: [
        DET("CVE-OLD", "r-1"),       // pastDue → critical
        DET("CVE-NEW", "r-2"),
        DET("CVE-NEW", "r-3"),
        DET("CVE-NEW", "r-4"),
        DET("CVE-NEW", "r-5"),
        DET("CVE-NEW", "r-6"),
      ],
      kevCatalog: [
        KEV("CVE-OLD", "2026-04-01T00:00:00.000Z"),
        KEV("CVE-NEW", "2026-06-01T00:00:00.000Z"),
      ],
      now: NOW,
    });
    expect(r.rows[0].cveId).toBe("CVE-OLD"); // critical first
    expect(r.rows[1].cveId).toBe("CVE-NEW"); // then high
  });

  it("tracks affected services set", () => {
    const r = correlateKev({
      detections: [DET("CVE-2026-A", "r-1", "checkout"), DET("CVE-2026-A", "r-2", "billing")],
      kevCatalog: [KEV("CVE-2026-A", "2026-06-01T00:00:00.000Z")],
      now: NOW,
    });
    expect(r.rows[0].affectedServices).toEqual(["billing", "checkout"]);
  });
});
