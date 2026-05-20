/**
 * Vitest unit tests for the pure improver proposal synthesizer.
 */

import { describe, it, expect } from "vitest";
import { synthesizeImprovements, type ImproverSignal } from "../improverProposalSynthesizer";

const S = (kind: ImproverSignal["kind"], targetLabel: string, observedCount: number, evidenceRef = ""): ImproverSignal =>
  ({ kind, targetLabel, observedCount, evidenceRef });

describe("improverProposalSynthesizer", () => {
  it("empty signals → no proposals", () => {
    const r = synthesizeImprovements([]);
    expect(r.proposals).toEqual([]);
  });

  it("repeated_verifier_fail < 3 observations → no proposal", () => {
    const r = synthesizeImprovements([S("repeated_verifier_fail", "rb-1", 2)]);
    expect(r.proposals).toEqual([]);
  });

  it("repeated_verifier_fail >= 3 → runbook_recipe proposal", () => {
    const r = synthesizeImprovements([S("repeated_verifier_fail", "rb-1", 3)]);
    expect(r.proposals[0].target).toBe("runbook_recipe");
    expect(r.proposals[0].confidence).toBeCloseTo(0.65, 2);
  });

  it("low_calibration_agent → charter_default proposal", () => {
    const r = synthesizeImprovements([S("low_calibration_agent", "reasoner", 1, "row-1")]);
    expect(r.proposals[0].target).toBe("charter_default");
  });

  it("frequent_dissent_pattern < 3 → no proposal", () => {
    expect(synthesizeImprovements([S("frequent_dissent_pattern", "pol-1", 2)]).proposals).toEqual([]);
  });

  it("missing_help_entry >= 3 → help_entry proposal", () => {
    const r = synthesizeImprovements([S("missing_help_entry", "how to approve", 4)]);
    expect(r.proposals[0].target).toBe("help_entry");
  });

  it("perKindCount tallies every signal even when no proposal emitted", () => {
    const r = synthesizeImprovements([
      S("missing_help_entry", "x", 1),     // < 3, no proposal
      S("missing_help_entry", "y", 5),     // proposal
      S("low_calibration_agent", "a", 1),  // proposal
    ]);
    expect(r.perKindCount.missing_help_entry).toBe(2);
    expect(r.perKindCount.low_calibration_agent).toBe(1);
    expect(r.proposals.length).toBe(2);
  });

  it("proposals sorted by target then label", () => {
    const r = synthesizeImprovements([
      S("missing_help_entry", "zzz topic", 5),
      S("repeated_verifier_fail", "rb-a", 3),
      S("repeated_verifier_fail", "rb-b", 3),
    ]);
    expect(r.proposals.map((p) => p.target)).toEqual(["help_entry", "runbook_recipe", "runbook_recipe"]);
  });

  it("proposalDiff is a typed object on every emitted proposal", () => {
    const r = synthesizeImprovements([
      S("repeated_verifier_fail", "rb-1", 3),
      S("low_calibration_agent", "a", 1),
      S("frequent_dissent_pattern", "pol-1", 3),
    ]);
    for (const p of r.proposals) expect(typeof p.proposedDiff).toBe("object");
  });
});
