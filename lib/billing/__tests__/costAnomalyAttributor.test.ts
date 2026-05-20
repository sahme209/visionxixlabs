/**
 * Vitest unit tests for the pure cost anomaly attributor.
 */

import { describe, it, expect } from "vitest";
import { attributeCostAnomalies, type DailyLine } from "../costAnomalyAttributor";

const L = (dateKey: string, service: string, tag: string, spendUSD: number): DailyLine =>
  ({ dateKey, service, tag, spendUSD });

const TODAY = "2026-05-20";

describe("costAnomalyAttributor", () => {
  it("empty input → empty report", () => {
    const r = attributeCostAnomalies({ todayKey: TODAY, daily: [] });
    expect(r.rows.length).toBe(0);
    expect(r.topOffenders.length).toBe(0);
  });

  it("flags a service whose today spend is far above baseline", () => {
    const daily = [
      L("2026-05-13", "checkout", "(none)", 100),
      L("2026-05-14", "checkout", "(none)", 110),
      L("2026-05-15", "checkout", "(none)", 95),
      L(TODAY,        "checkout", "(none)", 500),
    ];
    const r = attributeCostAnomalies({ todayKey: TODAY, daily });
    const row = r.rows.find((x) => x.service === "checkout")!;
    expect(row.severity).toBe("high");
    expect(row.deltaUsd).toBeGreaterThan(0);
  });

  it("does NOT flag when delta is below threshold $", () => {
    const daily = [
      L("2026-05-13", "low-svc", "(none)", 100),
      L("2026-05-14", "low-svc", "(none)", 100),
      L(TODAY,        "low-svc", "(none)", 130),  // +30 below default $50
    ];
    const r = attributeCostAnomalies({ todayKey: TODAY, daily });
    expect(r.rows[0].severity).toBe("ok");
  });

  it("does NOT flag when delta% is below threshold", () => {
    const daily = [
      L("2026-05-13", "big-svc", "(none)", 10_000),
      L("2026-05-14", "big-svc", "(none)", 10_000),
      L(TODAY,        "big-svc", "(none)", 12_000),  // +20% < default 25%
    ];
    const r = attributeCostAnomalies({ todayKey: TODAY, daily });
    expect(r.rows[0].severity).toBe("ok");
  });

  it("respects custom thresholds", () => {
    const daily = [
      L("2026-05-13", "svc", "(none)", 100),
      L(TODAY,        "svc", "(none)", 110),  // +10 / +10%
    ];
    const r = attributeCostAnomalies({ todayKey: TODAY, daily, flagThresholdPct: 5, flagThresholdUsd: 5 });
    expect(r.rows[0].severity).not.toBe("ok");
  });

  it("handles a brand-new (no baseline) service by flagging at delta% = 100", () => {
    const daily = [L(TODAY, "new-svc", "(none)", 500)];
    const r = attributeCostAnomalies({ todayKey: TODAY, daily });
    expect(r.rows[0].deltaPct).toBe(100);
  });

  it("severity: <2x threshold → watch; >=2x → high", () => {
    const daily = [
      L("2026-05-13", "svc", "(none)", 100),
      L(TODAY,        "svc", "(none)", 130),  // +30% (default 25%) → watch
    ];
    const r = attributeCostAnomalies({ todayKey: TODAY, daily, flagThresholdUsd: 0 });
    expect(r.rows[0].severity).toBe("watch");

    const daily2 = [
      L("2026-05-13", "svc", "(none)", 100),
      L(TODAY,        "svc", "(none)", 200),
    ];
    const r2 = attributeCostAnomalies({ todayKey: TODAY, daily: daily2, flagThresholdUsd: 0 });
    expect(r2.rows[0].severity).toBe("high");
  });

  it("rows sorted by deltaUsd desc", () => {
    const daily = [
      L("2026-05-13", "low", "(none)", 100),
      L(TODAY,        "low", "(none)", 130),
      L("2026-05-13", "hi",  "(none)", 100),
      L(TODAY,        "hi",  "(none)", 500),
    ];
    const r = attributeCostAnomalies({ todayKey: TODAY, daily });
    expect(r.rows[0].service).toBe("hi");
    expect(r.rows[1].service).toBe("low");
  });
});
