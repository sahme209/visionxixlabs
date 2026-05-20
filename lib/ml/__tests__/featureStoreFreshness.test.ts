/**
 * Vitest unit tests for the pure ML feature-store freshness tracker.
 */

import { describe, it, expect } from "vitest";
import { trackFeatureFreshness, type FeatureRecord } from "../featureStoreFreshness";

const NOW = "2026-05-20T12:00:00Z";

const F = (name: string, lastRefreshedAtIso: string, slaHours = 24, owner = "team-data"): FeatureRecord =>
  ({ name, owner, slaHours, lastRefreshedAtIso });

describe("featureStoreFreshness", () => {
  it("empty input → ok overall", () => {
    const r = trackFeatureFreshness({ features: [], nowIso: NOW });
    expect(r.overall).toBe("ok");
    expect(r.rows).toEqual([]);
  });

  it("recent refresh within SLA → fresh", () => {
    const r = trackFeatureFreshness({
      features: [F("ltv", "2026-05-20T11:00:00Z", 24)],
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("fresh");
    expect(r.overall).toBe("ok");
  });

  it("within 20% of SLA → warn_near_sla", () => {
    const r = trackFeatureFreshness({
      features: [F("ltv", "2026-05-19T13:00:00Z", 24)], // 23h ago → 96% of SLA
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("warn_near_sla");
    expect(r.overall).toBe("warn");
  });

  it("past SLA → stale + fail overall", () => {
    const r = trackFeatureFreshness({
      features: [F("ltv", "2026-05-18T00:00:00Z", 24)], // 60h ago
      nowIso: NOW,
    });
    expect(r.rows[0].status).toBe("stale");
    expect(r.overall).toBe("fail");
  });

  it("slow refresh detected when last >= 2× mean", () => {
    const r = trackFeatureFreshness({
      features: [{
        name: "ltv", owner: "team-data", slaHours: 24,
        lastRefreshedAtIso: "2026-05-20T11:00:00Z",
        lastRefreshDurationMs: 6000, meanRefreshDurationMs: 1000,
      }],
      nowIso: NOW,
    });
    expect(r.rows[0].slowRefresh).toBe(true);
    expect(r.rows[0].durationRatio).toBe(6);
  });

  it("durationRatio = Infinity when mean missing/0 but last > 0", () => {
    const r = trackFeatureFreshness({
      features: [{
        name: "ltv", owner: "x", slaHours: 24,
        lastRefreshedAtIso: "2026-05-20T11:00:00Z",
        lastRefreshDurationMs: 5000,
      }],
      nowIso: NOW,
    });
    expect(r.rows[0].durationRatio).toBe(Infinity);
    expect(r.rows[0].slowRefresh).toBe(true);
  });

  it("rows sorted stale → warn_near_sla → fresh", () => {
    const r = trackFeatureFreshness({
      features: [
        F("fresh-one",  "2026-05-20T11:00:00Z", 24),
        F("stale-one",  "2026-05-18T00:00:00Z", 24),
        F("warn-one",   "2026-05-19T13:00:00Z", 24),
      ],
      nowIso: NOW,
    });
    expect(r.rows.map((x) => x.name)).toEqual(["stale-one", "warn-one", "fresh-one"]);
  });

  it("totals match status counts", () => {
    const r = trackFeatureFreshness({
      features: [
        F("a", "2026-05-20T11:00:00Z", 24), // fresh
        F("b", "2026-05-19T13:00:00Z", 24), // warn
        F("c", "2026-05-18T00:00:00Z", 24), // stale
      ],
      nowIso: NOW,
    });
    expect(r.totals).toEqual({ fresh: 1, warn_near_sla: 1, stale: 1 });
  });
});
