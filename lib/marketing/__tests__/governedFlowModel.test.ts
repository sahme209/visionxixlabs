import { describe, expect, it } from "vitest";
import {
  FLOW_EXTERNAL_SYSTEMS,
  FLOW_HOLD_USD,
  FLOW_SCENARIOS,
  FLOW_STATION_IDS,
  FLOW_STATIONS,
  flowAuditLog,
  flowGauges,
  flowScenario,
  flowStationState,
} from "../governedFlowModel";

describe("governed flow model", () => {
  it("has one complete explanation per station, in order", () => {
    expect(FLOW_STATIONS.map((s) => s.id)).toEqual([...FLOW_STATION_IDS]);
    for (const s of FLOW_STATIONS) {
      expect(s.steps.length).toBeGreaterThanOrEqual(3);
      expect(s.dataIn.length).toBeGreaterThan(0);
      expect(s.dataOut.length).toBeGreaterThan(0);
      for (const field of [s.summary, s.systems, s.guarantee, s.onFailure]) expect(field.trim().length).toBeGreaterThan(10);
      expect(s.readout).toHaveLength(4);
    }
  });

  it("keeps the honest capability limits visible", () => {
    const text = (id: string) => JSON.stringify(FLOW_STATIONS.find((s) => s.id === id));
    expect(text("policy_scans")).toMatch(/does not run your build/);
    expect(text("execute")).toMatch(/Terraform apply is not available/);
    expect(text("approval_gate")).toMatch(/never approve their own request/);
    expect(text("validate")).toMatch(/never counts as proof of success/);
    expect(text("ai_analysis")).toMatch(/virtual model routes are refused/);
    expect(JSON.stringify(FLOW_STATIONS)).not.toMatch(/terraform apply (runs|executes)/i);
  });

  it("ties every external system to a real station", () => {
    for (const system of FLOW_EXTERNAL_SYSTEMS) expect(FLOW_STATION_IDS).toContain(system.station);
  });

  it("stops each scenario where it says and colors the blocking stage", () => {
    const last = FLOW_STATIONS.length - 1;
    for (const s of FLOW_SCENARIOS) {
      expect(s.stop).toBeGreaterThanOrEqual(0);
      expect(s.stop).toBeLessThanOrEqual(last);
      if (s.blockedAt !== undefined) expect(flowStationState(s, s.blockedAt, s.stop)).toBe("blocked");
      if (s.warningAt !== undefined) expect(flowStationState(s, s.warningAt, s.stop)).toBe("warning");
      for (let i = s.stop + 1; i <= last; i++) expect(flowStationState(s, i, s.stop)).toBe("unreached");
    }
    expect(flowStationState(flowScenario("failed_scan"), 3, 2)).toBe("unreached");
    expect(flowStationState(flowScenario("rejected"), 4, 3)).toBe("unreached");
  });

  it("holds AI credit during the call and settles it right after, in every scenario", () => {
    for (const s of FLOW_SCENARIOS) {
      expect(flowGauges(s, 0)).toMatchObject({ aiCreditState: "none", aiCreditUsd: 0, tokens: 0, approval: "Not requested" });
      expect(flowGauges(s, 1)).toMatchObject({ aiCreditState: "held", aiCreditUsd: FLOW_HOLD_USD });
      if (s.stop >= 2) expect(flowGauges(s, 2)).toMatchObject({ aiCreditState: "settled", aiCreditUsd: s.settledCostUsd });
      expect(s.settledCostUsd).toBeGreaterThan(0);
    }
  });

  it("never shows approval or an outcome the scenario did not reach", () => {
    expect(flowGauges(flowScenario("failed_scan"), 7)).toMatchObject({ stage: "Policy and scans", approval: "Pending", outcome: "Not started" });
    expect(flowGauges(flowScenario("rejected"), 7)).toMatchObject({ approval: "Rejected", outcome: "Not started" });
    expect(flowGauges(flowScenario("unknown_outcome"), 7).outcome).toBe("Unknown, reconcile");
  });

  it("writes the audit stream up to the reached stage, with failure entries", () => {
    expect(flowAuditLog(flowScenario("approved"), 7)).toHaveLength(8);
    const scan = flowAuditLog(flowScenario("failed_scan"), 7);
    expect(scan).toHaveLength(3);
    expect(scan.at(-1)).toMatchObject({ event: "readiness.blocked", level: "blocked" });
    expect(flowAuditLog(flowScenario("rejected"), 7).at(-1)).toMatchObject({ event: "approval.rejected", level: "blocked" });
    expect(flowAuditLog(flowScenario("unknown_outcome"), 7).at(-1)).toMatchObject({ event: "execution.unknown", level: "warning" });
    expect(flowAuditLog(flowScenario("rollback"), 7).map((e) => e.event)).toContain("rollback.requested");
  });

  it("rejects an unknown scenario id", () => {
    expect(() => flowScenario("nope" as never)).toThrow("unknown_flow_scenario");
  });
});
