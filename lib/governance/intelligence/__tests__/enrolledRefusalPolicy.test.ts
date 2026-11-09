import { describe, expect, it } from "vitest";
import { isAutonomyLoosening, isPrivilegeIncrease, isSafetyNotification, isSafetyWebhook } from "../enrolledRefusalPolicy";

describe("enrolled refusal policy", () => {
  it("always delivers safety alerts", () => {
    for (const kind of ["autonomy_halt_needs_human", "autonomy_halt_unsafe", "autonomy_halt_policy", "critical_telemetry_signal", "critical_incident"]) expect(isSafetyNotification({ kind, severity: "info" })).toBe(true);
    expect(isSafetyNotification({ kind: "cycle_summary", severity: "critical" })).toBe(true);
    expect(isSafetyNotification({ outcome: "critical" })).toBe(true);
  });

  it("treats routine sends as discretionary", () => {
    for (const kind of ["cycle_summary", "approval_packet_ready", "budget_threshold_breach", "release_blocker"]) expect(isSafetyNotification({ kind, severity: "high" })).toBe(false);
    expect(isSafetyNotification({ outcome: "active" })).toBe(false);
    expect(isSafetyNotification({})).toBe(false);
  });

  it("always delivers security webhooks, refuses the rest", () => {
    for (const k of ["audit.integrity_failed", "api_key.created", "api_key.revoked"]) expect(isSafetyWebhook(k)).toBe(true);
    for (const k of ["pipeline.run_completed", "agent_gateway.request_pending", "workspace.access_requested", "", null]) expect(isSafetyWebhook(k)).toBe(false);
  });

  it("refuses only privilege increases", () => {
    expect(isPrivilegeIncrease("operator", "admin")).toBe(true);
    expect(isPrivilegeIncrease("read_only", "finance_viewer")).toBe(true);
    expect(isPrivilegeIncrease(null, "read_only")).toBe(true);
    expect(isPrivilegeIncrease("admin", "operator")).toBe(false);
    expect(isPrivilegeIncrease("operator", "operator")).toBe(false);
    expect(isPrivilegeIncrease("admin", null)).toBe(false);
  });

  it("refuses only autonomy loosening", () => {
    const cur = { mode: "review", perCycleActionLimit: 5 };
    expect(isAutonomyLoosening(cur, { mode: "assisted", perCycleActionLimit: 5 })).toBe(true);
    expect(isAutonomyLoosening(cur, { mode: "review", perCycleActionLimit: 6 })).toBe(true);
    expect(isAutonomyLoosening(cur, { mode: "observer", perCycleActionLimit: 5 })).toBe(false);
    expect(isAutonomyLoosening(cur, { mode: "review", perCycleActionLimit: 2 })).toBe(false);
    expect(isAutonomyLoosening(null, { mode: "observer", perCycleActionLimit: 1 })).toBe(false);
    expect(isAutonomyLoosening(null, { mode: "review", perCycleActionLimit: 1 })).toBe(true);
    expect(isAutonomyLoosening(cur, { mode: "unknown_mode", perCycleActionLimit: 1 })).toBe(true);
  });

  it("fails closed on unknown roles", () => {
    expect(isPrivilegeIncrease("operator", "superuser")).toBe(true);
    expect(isPrivilegeIncrease("mystery", "read_only")).toBe(false);
  });
});
