/**
 * Vitest unit tests for the proposal vetter.
 *
 * Locks in: per-target schema checks, dangerous-policy rejection,
 * tier-cap bounds, duplication warnings (exact hash + fuzzy label),
 * diffHash is sha256-hex.
 */

import { describe, it, expect } from "vitest";
import { vetProposal } from "../proposalVetter";

describe("proposal vetter — parse stage", () => {
  it("rejects non-object diffs", () => {
    const r = vetProposal({
      proposalId: "p1",
      target: "runbook_recipe",
      proposedDiff: "not an object" as unknown,
      label: "anything",
    });
    expect(r.stages[0].verdict).toBe("fail");
    expect(r.approvable).toBe(false);
  });

  it("accepts a runbook_recipe diff with eventName + reversal", () => {
    const r = vetProposal({
      proposalId: "p1",
      target: "runbook_recipe",
      proposedDiff: { eventName: "DeleteBucket", reversal: { label: "x" } },
      label: "Tighten DeleteBucket",
    });
    expect(r.stages[0].verdict).toBe("ok");
  });

  it("rejects a runbook_recipe diff with no eventName", () => {
    const r = vetProposal({
      proposalId: "p1",
      target: "runbook_recipe",
      proposedDiff: { reversal: { label: "x" } },
      label: "anything",
    });
    expect(r.stages[0].verdict).toBe("fail");
  });

  it("rejects a policy_template diff missing cloud/policyJson", () => {
    const r = vetProposal({
      proposalId: "p1",
      target: "policy_template",
      proposedDiff: { cloud: "aws" }, // missing policyJson
      label: "anything",
    });
    expect(r.stages[0].verdict).toBe("fail");
  });
});

describe("proposal vetter — safety stage", () => {
  it("rejects an Action:* + Effect:Allow open-door policy", () => {
    const r = vetProposal({
      proposalId: "p1",
      target: "policy_template",
      proposedDiff: {
        cloud: "aws",
        policyJson: JSON.stringify({ Statement: [{ Effect: "Allow", Action: "*" }] }),
      },
      label: "Test policy",
    });
    const safety = r.stages.find((s) => s.stage === "safety")!;
    expect(safety.verdict).toBe("fail");
    expect(r.approvable).toBe(false);
  });

  it("rejects negative tier_cap newValue beyond -1", () => {
    const r = vetProposal({
      proposalId: "p1",
      target: "tier_cap",
      proposedDiff: { tier: "starter", capName: "outboundPerDay", newValue: -500 },
      label: "Bad cap",
    });
    const safety = r.stages.find((s) => s.stage === "safety")!;
    expect(safety.verdict).toBe("fail");
  });

  it("warns on tier_cap newValue above 100_000", () => {
    const r = vetProposal({
      proposalId: "p1",
      target: "tier_cap",
      proposedDiff: { tier: "enterprise", capName: "outboundPerDay", newValue: 500_000 },
      label: "Bulk lift cap",
    });
    const safety = r.stages.find((s) => s.stage === "safety")!;
    expect(safety.verdict).toBe("warn");
    expect(r.approvable).toBe(true); // warn doesn't block
  });

  it("warns on charter_default → autonomous without an 'approved' marker in label", () => {
    const r = vetProposal({
      proposalId: "p1",
      target: "charter_default",
      proposedDiff: { mode: "autonomous" },
      label: "Flip to autonomous",
    });
    const safety = r.stages.find((s) => s.stage === "safety")!;
    expect(safety.verdict).toBe("warn");
  });
});

describe("proposal vetter — duplication stage", () => {
  const HASH_FIRST = vetProposal({
    proposalId: "p1",
    target: "runbook_recipe",
    proposedDiff: { eventName: "DeleteBucket", reversal: { label: "x" } },
    label: "Tighten DeleteBucket",
  }).diffHash;

  it("warns when an identical diff hash was proposed recently", () => {
    const r = vetProposal({
      proposalId: "p2",
      target: "runbook_recipe",
      proposedDiff: { eventName: "DeleteBucket", reversal: { label: "x" } },
      label: "Tighten DeleteBucket (v2)",
      recentDiffHashes: [HASH_FIRST],
    });
    const dup = r.stages.find((s) => s.stage === "duplication")!;
    expect(dup.verdict).toBe("warn");
  });

  it("warns when an identical normalized label was used recently", () => {
    const r = vetProposal({
      proposalId: "p3",
      target: "runbook_recipe",
      proposedDiff: { eventName: "DeleteBucket", hardening: { label: "y" } },
      label: "  Tighten DeleteBucket  ",
      recentLabels: ["Tighten DeleteBucket"],
    });
    const dup = r.stages.find((s) => s.stage === "duplication")!;
    expect(dup.verdict).toBe("warn");
  });

  it("no warning when neither hash nor label collides", () => {
    const r = vetProposal({
      proposalId: "p4",
      target: "runbook_recipe",
      proposedDiff: { eventName: "DisableKey", reversal: { label: "z" } },
      label: "Re-enable disabled KMS keys",
      recentDiffHashes: [HASH_FIRST],
      recentLabels: ["Tighten DeleteBucket"],
    });
    const dup = r.stages.find((s) => s.stage === "duplication")!;
    expect(dup.verdict).toBe("ok");
  });
});

describe("proposal vetter — output shape", () => {
  it("diffHash is 64-char lowercase hex", () => {
    const r = vetProposal({
      proposalId: "p1",
      target: "help_entry",
      proposedDiff: { id: "x", title: "Y" },
      label: "anything",
    });
    expect(r.diffHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("diffSummary is a non-empty string per target", () => {
    const targets: Array<{ target: import("../methodProposalModel").ProposalTarget; diff: unknown }> = [
      { target: "runbook_recipe", diff: { eventName: "X", reversal: {} } },
      { target: "policy_template", diff: { cloud: "aws", policyJson: "{}" } },
      { target: "charter_default", diff: { mode: "review" } },
      { target: "help_entry", diff: { id: "x", title: "y" } },
      { target: "tier_cap", diff: { tier: "starter", capName: "x", newValue: 10 } },
    ];
    for (const t of targets) {
      const r = vetProposal({
        proposalId: "p",
        target: t.target,
        proposedDiff: t.diff,
        label: "approved migration",
      });
      expect(r.diffSummary.length).toBeGreaterThan(0);
    }
  });
});
