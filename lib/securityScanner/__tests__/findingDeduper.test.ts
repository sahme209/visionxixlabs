/**
 * Vitest unit tests for the pure finding deduper.
 */

import { describe, it, expect } from "vitest";
import { dedupeFindings, type RawFinding } from "../findingDeduper";

const F = (id: string, controlId: string, severity: RawFinding["severity"], resourceId: string, fp?: string): RawFinding => ({
  id, controlId, severity, resourceId, fingerprint: fp,
  firstSeen: "2026-05-19T00:00:00.000Z",
  lastSeen:  "2026-05-20T00:00:00.000Z",
});

describe("findingDeduper", () => {
  it("empty input → empty report", () => {
    const r = dedupeFindings([]);
    expect(r.inputCount).toBe(0);
    expect(r.clusters.length).toBe(0);
    expect(r.collapseRatio).toBe(0);
  });

  it("groups by controlId+severity+fingerprint by default", () => {
    const r = dedupeFindings([
      F("a", "s3-pab", "high", "bucket-1"),
      F("b", "s3-pab", "high", "bucket-2"),
      F("c", "s3-pab", "high", "bucket-3"),
    ]);
    expect(r.clusters.length).toBe(1);
    expect(r.clusters[0].count).toBe(3);
    expect(r.clusters[0].affectedResourceIds).toEqual(["bucket-1", "bucket-2", "bucket-3"]);
  });

  it("different severity → separate clusters", () => {
    const r = dedupeFindings([
      F("a", "ctrl", "high", "r-1"),
      F("b", "ctrl", "low",  "r-2"),
    ]);
    expect(r.clusters.length).toBe(2);
  });

  it("explicit fingerprint splits clusters within same control+severity", () => {
    const r = dedupeFindings([
      F("a", "ctrl", "high", "r-1", "shape-A"),
      F("b", "ctrl", "high", "r-2", "shape-B"),
    ]);
    expect(r.clusters.length).toBe(2);
  });

  it("clusters sorted by count desc", () => {
    const r = dedupeFindings([
      F("a", "ctrl1", "high", "r-1"),
      F("b", "ctrl1", "high", "r-2"),
      F("c", "ctrl1", "high", "r-3"),
      F("d", "ctrl2", "high", "r-4"),
    ]);
    expect(r.clusters[0].controlId).toBe("ctrl1");
    expect(r.clusters[0].count).toBe(3);
  });

  it("collapseRatio reflects compression", () => {
    const r = dedupeFindings([
      F("a", "ctrl", "high", "r-1"),
      F("b", "ctrl", "high", "r-2"),
      F("c", "ctrl", "high", "r-3"),
      F("d", "ctrl", "high", "r-4"),
    ]);
    // 4 → 1 cluster = 75% collapsed
    expect(r.collapseRatio).toBeCloseTo(0.75, 5);
  });

  it("tracks earliest firstSeen + latest lastSeen", () => {
    const r = dedupeFindings([
      { id: "a", controlId: "c", severity: "high", resourceId: "r-1", firstSeen: "2026-05-15T00:00:00.000Z", lastSeen: "2026-05-18T00:00:00.000Z" },
      { id: "b", controlId: "c", severity: "high", resourceId: "r-2", firstSeen: "2026-05-10T00:00:00.000Z", lastSeen: "2026-05-20T00:00:00.000Z" },
    ]);
    expect(r.clusters[0].firstSeen).toBe("2026-05-10T00:00:00.000Z");
    expect(r.clusters[0].lastSeen).toBe("2026-05-20T00:00:00.000Z");
  });

  it("doesn't duplicate resourceIds within a cluster", () => {
    const r = dedupeFindings([
      F("a", "c", "high", "r-1"),
      F("b", "c", "high", "r-1"),
      F("c", "c", "high", "r-1"),
    ]);
    expect(r.clusters[0].count).toBe(3);
    expect(r.clusters[0].affectedResourceIds).toEqual(["r-1"]);
  });
});
