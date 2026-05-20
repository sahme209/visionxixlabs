/**
 * Vitest unit tests for the pure approver packet assembler.
 */

import { describe, it, expect } from "vitest";
import { assembleApprovalPacket, type PacketSeed } from "../approverPacketAssembler";

const GOOD: PacketSeed = {
  hypothesisId: "h-1",
  hypothesisKind: "drift_remediation_needed",
  candidateLabel: "Tighten S3 PAB",
  candidateKind: "tighten_s3_pab",
  blastRadius: "single_resource",
  simulatorOk: true, policyGateOk: true, boundaryGateOk: true,
  councilApproved: true, councilSupportWeight: 3, councilOpposeWeight: 1,
  councilDissentAgents: ["policy_gate"],
  boundaryClass: "low_blast_radius",
  evidenceCount: 2, estimatedDurationMins: 5,
};

describe("approverPacketAssembler", () => {
  it("happy path produces a packet with safety contract", () => {
    const r = assembleApprovalPacket(GOOD);
    expect(r.packet).not.toBeNull();
    expect(r.packet?.safetyContract).toBe("approval_only_no_execution");
  });

  it("simulator fail blocks", () => {
    const r = assembleApprovalPacket({ ...GOOD, simulatorOk: false });
    expect(r.packet).toBeNull();
    expect(r.rejectReason).toBe("simulator_failed");
  });

  it("policy fail blocks", () => {
    const r = assembleApprovalPacket({ ...GOOD, policyGateOk: false });
    expect(r.rejectReason).toBe("policy_gate_failed");
  });

  it("boundary fail blocks", () => {
    const r = assembleApprovalPacket({ ...GOOD, boundaryGateOk: false });
    expect(r.rejectReason).toBe("boundary_gate_failed");
  });

  it("council reject blocks", () => {
    const r = assembleApprovalPacket({ ...GOOD, councilApproved: false });
    expect(r.rejectReason).toBe("council_rejected");
  });

  it("dissent list rendered in summary", () => {
    const r = assembleApprovalPacket(GOOD);
    expect(r.packet?.packetSummary).toContain("Dissenters: policy_gate");
  });

  it("packetSummary always includes approval-only-no-execution string", () => {
    const r = assembleApprovalPacket(GOOD);
    expect(r.packet?.packetSummary).toContain("Approval-only-no-execution");
  });

  it("evidenceCount clamped >=0; estimatedDurationMins clamped >=1", () => {
    const r = assembleApprovalPacket({ ...GOOD, evidenceCount: -5, estimatedDurationMins: -100 });
    expect(r.packet?.evidenceCount).toBe(0);
    expect(r.packet?.estimatedDurationMins).toBe(1);
  });

  it("ladder of upstream failures: simulator wins over policy", () => {
    const r = assembleApprovalPacket({ ...GOOD, simulatorOk: false, policyGateOk: false });
    expect(r.rejectReason).toBe("simulator_failed");
  });
});
