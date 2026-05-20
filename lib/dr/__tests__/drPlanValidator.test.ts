/**
 * Vitest unit tests for the pure DR plan validator.
 */

import { describe, it, expect } from "vitest";
import { validateDrPlan, type DrServicePlan } from "../drPlanValidator";

const NOW = "2026-05-20T00:00:00Z";

const PLAN = (overrides: Partial<DrServicePlan> = {}): DrServicePlan => ({
  service: "checkout-api",
  rtoMins: 15, rpoMins: 5,
  primaryRegion: "us-east-1", failoverRegion: "us-west-2",
  lastDrillAtIso: "2026-05-10T00:00:00Z",
  drRunbookId: "rb-dr-checkout",
  tier: "tier_0",
  ...overrides,
});

describe("validateDrPlan", () => {
  it("happy path → ok status", () => {
    const r = validateDrPlan({ plans: [PLAN()], nowIso: NOW });
    expect(r.rows[0].status).toBe("ok");
    expect(r.overall).toBe("ok");
  });

  it("missing failover → fail", () => {
    const r = validateDrPlan({ plans: [PLAN({ failoverRegion: "" })], nowIso: NOW });
    expect(r.rows[0].findings.some((f) => f.kind === "missing_failover_region")).toBe(true);
    expect(r.rows[0].status).toBe("fail");
  });

  it("same-region failover → fail", () => {
    const r = validateDrPlan({
      plans: [PLAN({ failoverRegion: "us-east-1" })],
      nowIso: NOW,
    });
    expect(r.rows[0].findings.some((f) => f.kind === "same_region_failover")).toBe(true);
    expect(r.rows[0].status).toBe("fail");
  });

  it("missing runbook → fail", () => {
    const r = validateDrPlan({ plans: [PLAN({ drRunbookId: null })], nowIso: NOW });
    expect(r.rows[0].findings.some((f) => f.kind === "missing_runbook")).toBe(true);
  });

  it("never drilled → fail", () => {
    const r = validateDrPlan({ plans: [PLAN({ lastDrillAtIso: null })], nowIso: NOW });
    expect(r.rows[0].findings.some((f) => f.kind === "missing_drill")).toBe(true);
  });

  it("drill overdue (tier_0 cadence 30d) → warn", () => {
    const r = validateDrPlan({
      plans: [PLAN({ lastDrillAtIso: "2026-01-01T00:00:00Z" })],
      nowIso: NOW,
    });
    expect(r.rows[0].findings.some((f) => f.kind === "drill_overdue")).toBe(true);
    expect(r.rows[0].status).toBe("warn");
  });

  it("RTO above tier max → fail (tier_0 max 15m)", () => {
    const r = validateDrPlan({ plans: [PLAN({ rtoMins: 60 })], nowIso: NOW });
    expect(r.rows[0].findings.some((f) => f.kind === "rto_too_high")).toBe(true);
  });

  it("RPO above tier max → fail (tier_0 max 5m)", () => {
    const r = validateDrPlan({ plans: [PLAN({ rpoMins: 60 })], nowIso: NOW });
    expect(r.rows[0].findings.some((f) => f.kind === "rpo_too_high")).toBe(true);
  });

  it("RPO > RTO → warn", () => {
    const r = validateDrPlan({ plans: [PLAN({ rtoMins: 10, rpoMins: 12, tier: "tier_2" })], nowIso: NOW });
    expect(r.rows[0].findings.some((f) => f.kind === "rpo_exceeds_rto")).toBe(true);
  });

  it("rows sorted fail → warn → ok", () => {
    const r = validateDrPlan({
      plans: [
        PLAN({ service: "ok-svc" }),
        PLAN({ service: "fail-svc", failoverRegion: "us-east-1" }),
        PLAN({ service: "warn-svc", lastDrillAtIso: "2026-01-01T00:00:00Z" }),
      ],
      nowIso: NOW,
    });
    expect(r.rows.map((x) => x.service)).toEqual(["fail-svc", "warn-svc", "ok-svc"]);
  });
});
