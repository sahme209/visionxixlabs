/**
 * Vitest unit tests for the pure tenant-export size estimator.
 */

import { describe, it, expect } from "vitest";
import { estimateExportSize } from "../exportSizeEstimator";

describe("exportSizeEstimator", () => {
  it("zero rows → tiny estimate, size small, no warning", () => {
    const r = estimateExportSize({
      proposals: 0, busMessages: 0, rationaleRows: 0, outboundRecords: 0,
      billingPlanIncluded: false,
    });
    expect(r.size).toBe("small");
    expect(r.warning).toBeNull();
    expect(r.estimatedBytes).toBeGreaterThan(0); // wrapper bytes
  });

  it("billing plan adds 2000 bytes", () => {
    const a = estimateExportSize({ proposals: 0, busMessages: 0, rationaleRows: 0, outboundRecords: 0, billingPlanIncluded: false });
    const b = estimateExportSize({ proposals: 0, busMessages: 0, rationaleRows: 0, outboundRecords: 0, billingPlanIncluded: true });
    expect(b.estimatedBytes - a.estimatedBytes).toBe(2_000);
  });

  it("medium estimate (>100KB) → size medium", () => {
    const r = estimateExportSize({
      proposals: 100, busMessages: 500, rationaleRows: 100, outboundRecords: 100,
      billingPlanIncluded: true,
    });
    expect(r.size).toBe("medium");
    expect(r.warning).toBeNull();
  });

  it("large estimate (>5MB) → size large + warning", () => {
    const r = estimateExportSize({
      proposals: 5_000, busMessages: 5_000, rationaleRows: 5_000, outboundRecords: 5_000,
      billingPlanIncluded: true,
    });
    expect(r.size).toBe("large");
    expect(r.warning).toContain("large");
  });

  it("very large estimate (>50MB) → very_large + warning", () => {
    const r = estimateExportSize({
      proposals: 50_000, busMessages: 50_000, rationaleRows: 50_000, outboundRecords: 50_000,
      billingPlanIncluded: true,
    });
    expect(r.size).toBe("very_large");
    expect(r.warning).toContain("very large");
  });

  it("humanReadable picks correct unit", () => {
    const small = estimateExportSize({ proposals: 0, busMessages: 0, rationaleRows: 0, outboundRecords: 0, billingPlanIncluded: false });
    expect(small.estimatedHumanReadable).toMatch(/B$|KB$/);
    const big = estimateExportSize({ proposals: 100_000, busMessages: 0, rationaleRows: 0, outboundRecords: 0, billingPlanIncluded: false });
    expect(big.estimatedHumanReadable).toMatch(/MB$|GB$/);
  });

  it("perSlice = rows × avg bytes per row", () => {
    const r = estimateExportSize({
      proposals: 10, busMessages: 100, rationaleRows: 50, outboundRecords: 200,
      billingPlanIncluded: false,
    });
    expect(r.perSlice.proposals).toBe(10 * 1_400);
    expect(r.perSlice.busMessages).toBe(100 * 600);
    expect(r.perSlice.rationaleRows).toBe(50 * 1_200);
    expect(r.perSlice.outboundRecords).toBe(200 * 900);
  });
});
