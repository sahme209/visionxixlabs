/**
 * Vitest unit tests for the tenant insights synthesizer fallback path.
 */

import { describe, it, expect } from "vitest";
import { summarizeInsightsMetrics, type InsightsSeed } from "../tenantInsightsSynthesizer";

const SEED: InsightsSeed = {
  tenantId: "tenant-42",
  windowDays: 7,
  proposalsDecided: 10,
  proposalsApproved: 6,
  proposalsApplied: 4,
  proposalsRejected: 4,
  autonomyCycles: 120,
  outboundSends: 50,
  outboundFailures: 3,
  dissentCount: 5,
  topAuthorAgent: "improver",
};

describe("tenantInsightsSynthesizer", () => {
  it("builds the deterministic summary without a provider", () => {
    const r = summarizeInsightsMetrics(SEED);
    expect(r.aiUsed).toBe(false);
    expect(r.paragraph).toContain("7 day");
    expect(r.paragraph).toContain("10 proposal");
    expect(r.paragraph).toContain("6 approved");
    expect(r.paragraph).toContain("4 applied");
    expect(r.paragraph).toContain("4 rejected");
    expect(r.paragraph).toContain("120 autonomy");
    expect(r.paragraph).toContain("5 council consensus record");
  });

  it("mentions topAuthorAgent when present", () => {
    const r = summarizeInsightsMetrics(SEED);
    expect(r.paragraph).toContain("improver");
  });

  it("omits topAuthorAgent line when null", () => {
    const r = summarizeInsightsMetrics({ ...SEED, topAuthorAgent: null });
    expect(r.paragraph).not.toContain("Most active improver");
  });

  it("renders outbound ratio correctly when sends > 0", () => {
    const r = summarizeInsightsMetrics(SEED);
    expect(r.paragraph).toContain("47/50 sends ok");
  });

  it("uses 'no outbound sends' wording when sends == 0", () => {
    const r = summarizeInsightsMetrics({ ...SEED, outboundSends: 0, outboundFailures: 0 });
    expect(r.paragraph).toContain("no outbound sends");
  });
});
