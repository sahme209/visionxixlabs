/**
 * Vitest unit tests for the pure escalation policy engine.
 */

import { describe, it, expect } from "vitest";
import { decideEscalation, type EscalationInput, type PolicyStep } from "../escalationPolicyEngine";

const POLICY: Record<EscalationInput["severity"], readonly PolicyStep[]> = {
  low:      [{ tier: "primary", afterMinutes: 30 }],
  medium:   [{ tier: "primary", afterMinutes: 0 }, { tier: "secondary", afterMinutes: 30 }],
  high:     [{ tier: "primary", afterMinutes: 0 }, { tier: "secondary", afterMinutes: 15 }, { tier: "manager", afterMinutes: 45 }],
  critical: [{ tier: "primary", afterMinutes: 0 }, { tier: "manager", afterMinutes: 10 }, { tier: "exec", afterMinutes: 30 }],
};

describe("escalationPolicyEngine", () => {
  it("acknowledged → activeTier null", () => {
    const r = decideEscalation({
      openedAtSec: 0, nowSec: 600, acknowledged: true,
      severity: "high", policyBySeverity: POLICY,
    });
    expect(r.activeTier).toBeNull();
  });

  it("at t=0 high severity → primary active, secondary next at 15", () => {
    const r = decideEscalation({
      openedAtSec: 0, nowSec: 0, acknowledged: false,
      severity: "high", policyBySeverity: POLICY,
    });
    expect(r.activeTier).toBe("primary");
    expect(r.nextTier).toBe("secondary");
    expect(r.nextAtMinutes).toBe(15);
  });

  it("at t=20m high severity → secondary active, manager next at 45", () => {
    const r = decideEscalation({
      openedAtSec: 0, nowSec: 20 * 60, acknowledged: false,
      severity: "high", policyBySeverity: POLICY,
    });
    expect(r.activeTier).toBe("secondary");
    expect(r.nextTier).toBe("manager");
    expect(r.nextAtMinutes).toBe(45);
  });

  it("past the last tier → that tier stays active, nextTier null", () => {
    const r = decideEscalation({
      openedAtSec: 0, nowSec: 120 * 60, acknowledged: false,
      severity: "high", policyBySeverity: POLICY,
    });
    expect(r.activeTier).toBe("manager");
    expect(r.nextTier).toBeNull();
  });

  it("critical: exec active at t=45m", () => {
    const r = decideEscalation({
      openedAtSec: 0, nowSec: 45 * 60, acknowledged: false,
      severity: "critical", policyBySeverity: POLICY,
    });
    expect(r.activeTier).toBe("exec");
  });

  it("low severity below first step → activeTier null", () => {
    const r = decideEscalation({
      openedAtSec: 0, nowSec: 10 * 60, acknowledged: false,
      severity: "low", policyBySeverity: POLICY,
    });
    expect(r.activeTier).toBeNull();
    expect(r.nextTier).toBe("primary");
  });

  it("ageMinutes computed in minutes", () => {
    const r = decideEscalation({
      openedAtSec: 0, nowSec: 3 * 60 + 30, acknowledged: false,
      severity: "medium", policyBySeverity: POLICY,
    });
    expect(r.ageMinutes).toBe(3);
  });

  it("unsorted policy steps still produce correct active tier", () => {
    const r = decideEscalation({
      openedAtSec: 0, nowSec: 30 * 60, acknowledged: false,
      severity: "high",
      policyBySeverity: {
        ...POLICY,
        high: [
          { tier: "manager",  afterMinutes: 45 },
          { tier: "primary",  afterMinutes: 0  },
          { tier: "secondary",afterMinutes: 15 },
        ],
      },
    });
    expect(r.activeTier).toBe("secondary");
  });
});
