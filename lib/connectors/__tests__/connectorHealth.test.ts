/**
 * Tests pin the closed-union priority order + each branch's behavior.
 *
 * Priority (first match wins):
 *   auth_failed > rate_limited > stale > degraded > healthy
 *
 * If the kernel ever drifts from this, the failing test names tell you
 * which transition broke.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  computeConnectorHealth,
  type ConnectorTelemetry,
} from "../connectorHealth";

const NOW = new Date("2026-05-23T18:00:00.000Z");

function tele(over: Partial<ConnectorTelemetry> = {}): ConnectorTelemetry {
  // Fresh successful sync 1m ago, plenty of samples, all healthy.
  return {
    lastSuccessfulSyncAt: new Date(NOW.getTime() - 60_000),
    recentSuccessCount: 20,
    recentErrorCount: 0,
    authFailed: false,
    rateLimitedNow: false,
    category: "cloud",
    ...over,
  };
}

describe("computeConnectorHealth", () => {
  it("healthy when everything is in bounds", () => {
    const r = computeConnectorHealth(tele(), NOW);
    expect(r.status).toBe("healthy");
    expect(r.stage).toBe("ok");
    expect(r.successRatio).toBe(1);
  });

  it("auth_failed beats every other signal", () => {
    const r = computeConnectorHealth(
      tele({
        authFailed: true,
        rateLimitedNow: true,        // would otherwise be rate_limited
        lastSuccessfulSyncAt: null,  // would otherwise be stale
        recentErrorCount: 10, recentSuccessCount: 0, // would otherwise be degraded
      }),
      NOW,
    );
    expect(r.status).toBe("auth_failed");
    expect(r.stage).toBe("auth");
  });

  it("rate_limited beats stale + degraded", () => {
    const r = computeConnectorHealth(
      tele({
        rateLimitedNow: true,
        lastSuccessfulSyncAt: new Date(NOW.getTime() - 60 * 60 * 1000), // 1h ago (>30m cloud window)
        recentErrorCount: 8, recentSuccessCount: 2,
      }),
      NOW,
    );
    expect(r.status).toBe("rate_limited");
    expect(r.stage).toBe("rate_limit");
  });

  it("stale when never synced (non-IDE)", () => {
    const r = computeConnectorHealth(tele({ lastSuccessfulSyncAt: null }), NOW);
    expect(r.status).toBe("stale");
    expect(r.reason).toMatch(/No successful sync yet/);
  });

  it("stale when last sync older than the category window", () => {
    // db category staleness window = 5 minutes. Try 10 minutes old.
    const r = computeConnectorHealth(
      tele({
        category: "db",
        lastSuccessfulSyncAt: new Date(NOW.getTime() - 10 * 60 * 1000),
      }),
      NOW,
    );
    expect(r.status).toBe("stale");
    expect(r.ageMs).toBe(10 * 60 * 1000);
  });

  it("ide category is never stale (no expected heartbeat)", () => {
    const r = computeConnectorHealth(
      tele({
        category: "ide",
        lastSuccessfulSyncAt: new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000), // a year ago
      }),
      NOW,
    );
    expect(r.status).toBe("healthy");
  });

  it("degraded when success ratio drops below the threshold with enough samples", () => {
    const r = computeConnectorHealth(
      tele({ recentSuccessCount: 5, recentErrorCount: 5 }), // 50% < 85%
      NOW,
    );
    expect(r.status).toBe("degraded");
    expect(r.successRatio).toBeCloseTo(0.5, 5);
  });

  it("ratio test ignored when sample size below minRecentSamples", () => {
    // 1/3 = 33% is below the threshold, but only 3 samples — should not flag degraded.
    const r = computeConnectorHealth(
      tele({ recentSuccessCount: 1, recentErrorCount: 2 }),
      NOW,
    );
    expect(r.status).toBe("healthy");
  });

  it("returns ratio = null when no samples seen yet", () => {
    const r = computeConnectorHealth(
      tele({ recentSuccessCount: 0, recentErrorCount: 0 }),
      NOW,
    );
    expect(r.successRatio).toBeNull();
  });

  it("default thresholds match exported constants (regression guard)", () => {
    expect(DEFAULT_THRESHOLDS.degradedRatioThreshold).toBe(0.85);
    expect(DEFAULT_THRESHOLDS.minRecentSamples).toBe(5);
    expect(DEFAULT_THRESHOLDS.stalenessWindowMs.cloud).toBe(30 * 60 * 1000);
    expect(DEFAULT_THRESHOLDS.stalenessWindowMs.vcs).toBe(10 * 60 * 1000);
    expect(DEFAULT_THRESHOLDS.stalenessWindowMs.db).toBe(5 * 60 * 1000);
    expect(DEFAULT_THRESHOLDS.stalenessWindowMs.monitoring).toBe(15 * 60 * 1000);
  });
});
