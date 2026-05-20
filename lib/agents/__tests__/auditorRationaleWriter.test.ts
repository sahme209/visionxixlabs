/**
 * Vitest unit tests for the pure auditor rationale writer.
 */

import { describe, it, expect } from "vitest";
import { verifyRationaleRow, writeRationaleRow, type RationaleSeed } from "../auditorRationaleWriter";

const SEED: RationaleSeed = {
  hypothesisId: "h-1",
  hypothesisKind: "drift_remediation_needed",
  candidateLabel: "Tighten S3 PAB",
  candidateKind: "tighten_s3_pab",
  blastRadius: "single_resource",
  boundaryClass: "low_blast_radius",
  simulatorVerdict: "pass",
  policyVerdict: "pass",
  boundaryVerdict: "pass",
  councilSupport: 3, councilOppose: 1,
  councilDissentAgents: ["policy_gate"],
  operatorDecidedBy: "alice@example.com",
  operatorDecidedAtIso: "2026-05-20T15:00:00.000Z",
  finalDecision: "approved_pending_apply",
  verifierVerdict: "not_applicable",
};

describe("auditorRationaleWriter", () => {
  it("emits schema + version + safety contract", () => {
    const r = writeRationaleRow(SEED);
    expect(r.schema).toBe("axiom.rationale");
    expect(r.schemaVersion).toBe(1);
    expect(r.safetyContract).toBe("approval_only_no_execution");
  });

  it("integrityHash is sha256 hex", () => {
    const r = writeRationaleRow(SEED);
    expect(r.integrityHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("integrityHash is deterministic for identical seed", () => {
    const a = writeRationaleRow(SEED).integrityHash;
    const b = writeRationaleRow(SEED).integrityHash;
    expect(a).toBe(b);
  });

  it("integrityHash changes when any field changes", () => {
    const a = writeRationaleRow(SEED).integrityHash;
    const b = writeRationaleRow({ ...SEED, councilSupport: 99 }).integrityHash;
    expect(a).not.toBe(b);
  });

  it("dissenters sorted alphabetically (canonical form)", () => {
    const r = writeRationaleRow({
      ...SEED,
      councilDissentAgents: ["zeta", "alpha", "mu"],
    });
    expect(r.agentTrail.council.dissenters).toEqual(["alpha", "mu", "zeta"]);
  });

  it("verifyRationaleRow accepts untouched rows", () => {
    const r = writeRationaleRow(SEED);
    expect(verifyRationaleRow(r)).toBe(true);
  });

  it("verifyRationaleRow rejects tampered rows", () => {
    const r = writeRationaleRow(SEED);
    const tampered = { ...r, candidateLabel: "Tampered" };
    expect(verifyRationaleRow(tampered)).toBe(false);
  });

  it("full agent trail mirrored into the row", () => {
    const r = writeRationaleRow(SEED);
    expect(r.agentTrail.simulator).toBe("pass");
    expect(r.agentTrail.policy_gate).toBe("pass");
    expect(r.agentTrail.boundary_gate).toBe("pass");
    expect(r.agentTrail.council.support).toBe(3);
    expect(r.agentTrail.operator.finalDecision).toBe("approved_pending_apply");
    expect(r.agentTrail.verifier).toBe("not_applicable");
  });
});
