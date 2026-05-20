/**
 * Pure improver-agent proposal synthesizer.
 *
 * The improver agent watches the platform's own trail (decided
 * proposals, council dissent patterns, verifier failures) and
 * synthesizes new MethodProposal candidates the operator can review.
 * This module is the deterministic synthesizer — same inputs always
 * produce the same proposal stream.
 *
 * Pure / deterministic. No DB / network.
 */

import type { ProposalTarget } from "./methodProposalModel";

export interface ImproverSignal {
  /** Source signal kind so the proposal explains itself. */
  kind:
    | "repeated_verifier_fail"
    | "low_calibration_agent"
    | "frequent_dissent_pattern"
    | "stale_runbook"
    | "missing_help_entry";
  /** Operator-readable target label. */
  targetLabel: string;
  /** Count of observed occurrences. */
  observedCount: number;
  /** Anchored evidence string (rationale row id, agent name, etc.). */
  evidenceRef: string;
}

export interface SynthesizedProposal {
  target: ProposalTarget;
  label: string;
  rationale: string;
  proposedDiff: Record<string, unknown>;
  /** Initial confidence — improver is conservative until calibrated. */
  confidence: number;
}

export interface SynthesisResult {
  proposals: SynthesizedProposal[];
  /** Counts surfaced for the analytics dashboard. */
  perKindCount: Record<ImproverSignal["kind"], number>;
}

const MIN_OBSERVED = 3;

const initialCounts = (): Record<ImproverSignal["kind"], number> => ({
  repeated_verifier_fail: 0,
  low_calibration_agent: 0,
  frequent_dissent_pattern: 0,
  stale_runbook: 0,
  missing_help_entry: 0,
});

function synthesizeOne(sig: ImproverSignal): SynthesizedProposal | null {
  switch (sig.kind) {
    case "repeated_verifier_fail": {
      // 3+ verifier failures for a runbook recipe → propose tightening
      // pre-execution assertions in the runbook recipe.
      if (sig.observedCount < MIN_OBSERVED) return null;
      return {
        target: "runbook_recipe",
        label: `Add post-exec metric guard to "${sig.targetLabel}" runbook recipe`,
        rationale: `Verifier failed ${sig.observedCount}× on this recipe. Proposing stricter post-exec assertions before approval can succeed.`,
        proposedDiff: { addAssertion: { kind: "metric_in_range", detail: "p95 latency ratio ≤ 1.5" } },
        confidence: 0.65,
      };
    }
    case "low_calibration_agent": {
      // An improver agent's calibration gap is wide → propose lowering its
      // default confidence multiplier.
      if (sig.observedCount < 1) return null;
      return {
        target: "charter_default",
        label: `Trim default confidence weight of "${sig.targetLabel}" agent`,
        rationale: `Agent's approval rate trails declared confidence by a significant margin (see ${sig.evidenceRef}). Proposing a 0.8× weight multiplier.`,
        proposedDiff: { agent: sig.targetLabel, weightMultiplier: 0.8 },
        confidence: 0.5,
      };
    }
    case "frequent_dissent_pattern": {
      // Same dissenter keeps voting against approved hypotheses on a
      // policy_template — propose softening the policy template.
      if (sig.observedCount < MIN_OBSERVED) return null;
      return {
        target: "policy_template",
        label: `Review "${sig.targetLabel}" — frequent dissent pattern observed`,
        rationale: `${sig.observedCount} dissents on similar candidates. Worth a human re-read of the policy template.`,
        proposedDiff: { policyId: sig.targetLabel, action: "review_for_relax" },
        confidence: 0.4,
      };
    }
    case "stale_runbook": {
      if (sig.observedCount < 1) return null;
      return {
        target: "runbook_recipe",
        label: `Refresh stale runbook "${sig.targetLabel}"`,
        rationale: `Runbook hasn't been touched in a long while; proposing a deprecation review.`,
        proposedDiff: { recipeId: sig.targetLabel, action: "review_for_deprecation" },
        confidence: 0.45,
      };
    }
    case "missing_help_entry": {
      // A no-match cluster in the help system has built up — propose
      // adding a help entry stub.
      if (sig.observedCount < MIN_OBSERVED) return null;
      return {
        target: "help_entry",
        label: `Add help entry for cluster "${sig.targetLabel}"`,
        rationale: `Operators searched for this ${sig.observedCount}× without a match.`,
        proposedDiff: { id: "help.suggestion", title: sig.targetLabel, status: "draft" },
        confidence: 0.55,
      };
    }
  }
}

export function synthesizeImprovements(signals: readonly ImproverSignal[]): SynthesisResult {
  const proposals: SynthesizedProposal[] = [];
  const perKindCount = initialCounts();
  for (const sig of signals) {
    perKindCount[sig.kind] += 1;
    const p = synthesizeOne(sig);
    if (p) proposals.push(p);
  }
  // Stable sort: by target then label for deterministic UI ordering.
  proposals.sort((a, b) => {
    if (a.target !== b.target) return a.target < b.target ? -1 : 1;
    return a.label < b.label ? -1 : 1;
  });
  return { proposals, perKindCount };
}
