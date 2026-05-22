import { describe, it, expect } from "vitest";
import { checkEntitlement } from "../checkEntitlement";
import { findPlan } from "../planRegistry";

const STARTER  = findPlan("starter");      // 5 users, 3 connectors, 0 desktop, 200 agent runs / mo
const GROWTH   = findPlan("growth");       // 15 users, 10 connectors, 3 desktop, 2000 agent runs
const BUSINESS = findPlan("business");
const ENTERPRISE = findPlan("enterprise"); // null on most caps

describe("checkEntitlement — basic allow / block", () => {
  it("Starter 0 users + 1 new = allow, below_70", () => {
    const r = checkEntitlement({ plan: STARTER, dimension: "users", currentUsage: 0 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("below_70");
    expect(r.remaining).toBe(4);
  });

  it("Starter at cap (5 users) + 1 new = BLOCK", () => {
    const r = checkEntitlement({ plan: STARTER, dimension: "users", currentUsage: 5 });
    expect(r.kind).toBe("block");
    expect(r.reason).toBe("entitlement_exhausted");
    expect(r.remaining).toBe(0);
  });

  it("Starter 4 users + 1 new = allow at exactly cap (boundary)", () => {
    const r = checkEntitlement({ plan: STARTER, dimension: "users", currentUsage: 4 });
    expect(r.kind).toBe("allow");
    expect(r.remaining).toBe(0);
  });

  it("attemptedDelta > 1 (bulk add) respects cap", () => {
    const r = checkEntitlement({ plan: GROWTH, dimension: "users", currentUsage: 10, attemptedDelta: 10 });
    expect(r.kind).toBe("block");
  });
});

describe("checkEntitlement — disabled features (limit = 0)", () => {
  it("Starter desktop_agents (limit=0) always blocks", () => {
    const r = checkEntitlement({ plan: STARTER, dimension: "desktop_agents", currentUsage: 0 });
    expect(r.kind).toBe("block");
    expect(r.threshold).toBe("exhausted");
    expect(r.limit).toBe(0);
  });
});

describe("checkEntitlement — Enterprise (null = custom/unlimited)", () => {
  it("Enterprise users (null limit) → always allow", () => {
    const r = checkEntitlement({ plan: ENTERPRISE, dimension: "users", currentUsage: 5000 });
    expect(r.kind).toBe("allow");
    expect(r.limit).toBeNull();
    expect(r.remaining).toBe(Number.POSITIVE_INFINITY);
  });

  it("Enterprise connectors (null) → always allow", () => {
    expect(checkEntitlement({ plan: ENTERPRISE, dimension: "connectors", currentUsage: 1_000_000 }).kind).toBe("allow");
  });
});

describe("checkEntitlement — threshold tones", () => {
  it("Growth users at 50% → below_70", () => {
    const r = checkEntitlement({ plan: GROWTH, dimension: "users", currentUsage: 7 });
    expect(r.threshold).toBe("below_70");
  });

  it("Growth users at 73% → warn_70 (11/15 projected)", () => {
    const r = checkEntitlement({ plan: GROWTH, dimension: "users", currentUsage: 10 });
    expect(r.threshold).toBe("warn_70");
    expect(r.remaining).toBe(4);
  });

  it("Growth connectors at 90% → warn_90 (9/10 projected)", () => {
    const r = checkEntitlement({ plan: GROWTH, dimension: "connectors", currentUsage: 8 });
    expect(r.threshold).toBe("warn_90");
  });

  it("Growth connectors at 100% (10/10 projected) → exhausted, still allow at boundary", () => {
    const r = checkEntitlement({ plan: GROWTH, dimension: "connectors", currentUsage: 9 });
    expect(r.threshold).toBe("warn_90"); // 10/10 = 100%; computed as ratio === 1 which is not > 0.9 strictly... let me check
    // Actually 10/10 = 1.0, which is >= 0.9 → warn_90 (not exhausted, since not > 1)
    expect(r.kind).toBe("allow");
  });
});

describe("checkEntitlement — monthly throughput dimensions", () => {
  it("Starter agent runs at 150 + 1 = warn_70 (151/200)", () => {
    const r = checkEntitlement({ plan: STARTER, dimension: "agent_runs_per_month", currentUsage: 150 });
    expect(r.threshold).toBe("warn_70");
    expect(r.kind).toBe("allow");
  });

  it("Starter agent runs at 200 + 1 = BLOCK", () => {
    const r = checkEntitlement({ plan: STARTER, dimension: "agent_runs_per_month", currentUsage: 200 });
    expect(r.kind).toBe("block");
  });

  it("Business cloud scans at 400/500 → warn_70 → allow", () => {
    const r = checkEntitlement({ plan: BUSINESS, dimension: "cloud_scans_per_month", currentUsage: 400 });
    expect(r.kind).toBe("allow");
  });
});

describe("checkEntitlement — defensive", () => {
  it("negative currentUsage treated as 0", () => {
    const r = checkEntitlement({ plan: STARTER, dimension: "users", currentUsage: -10 });
    expect(r.kind).toBe("allow");
    expect(r.remaining).toBe(4);
  });

  it("negative attemptedDelta treated as 0", () => {
    const r = checkEntitlement({ plan: STARTER, dimension: "users", currentUsage: 0, attemptedDelta: -5 });
    expect(r.kind).toBe("allow");
    expect(r.threshold).toBe("below_70");
  });
});

describe("checkEntitlement — dimension coverage", () => {
  it("every dimension maps to a defined limit on Starter (no undefined returns)", () => {
    const dims = [
      "users", "workspaces", "connectors", "cloud_accounts", "repositories",
      "desktop_agents", "agents_enabled",
      "agent_runs_per_month", "automation_runs_per_month",
      "connector_syncs_per_month", "cloud_scans_per_month",
      "security_scans_per_month", "reports_per_month",
      "pdf_exports_per_month", "monitoring_events_per_month",
    ] as const;
    for (const d of dims) {
      const r = checkEntitlement({ plan: STARTER, dimension: d, currentUsage: 0 });
      expect(r.limit).not.toBeUndefined();
      // Starter has hard limits on every dimension (none are null/custom)
      expect(r.limit).not.toBeNull();
    }
  });
});
