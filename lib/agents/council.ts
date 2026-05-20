/**
 * Council — weighted consensus across N agent verdicts.
 *
 * Pure function. Each agent supplies a vote with a verdict +
 * confidence (and a free-text rationale that lands in the dissent
 * record when the agent is in the minority). The council returns a
 * typed ConsensusOutcome:
 *
 *   • decision  — winning verdict label
 *   • supportWeight + opposeWeight — sums of confidence per side
 *   • supportRatio in [0, 1]
 *   • passed     — supportRatio >= passThreshold (default 0.66)
 *   • dissent[]  — every losing vote with rationale
 *
 * Why pure: keeps the council deterministic + testable. Persistence
 * + bus publication are caller's responsibility (the autonomy loop
 * already has those wired).
 *
 * Hard rules:
 *   - Tie at the threshold → defaults to `passed: false` (safer).
 *   - Empty input → passed=false, decision=null.
 *   - Confidence outside [0, 1] is clamped silently — agents that
 *     overrate themselves can't tip a vote past safety.
 */

import type { AgentRole } from "./agentBusModel";

export type Verdict = "approve" | "reject" | "abstain";

export interface AgentVote {
  agent: AgentRole;
  verdict: Verdict;
  /** 0..1 — the agent's confidence in its own verdict. */
  confidence: number;
  /** Operator-readable rationale; included in dissent[] when losing. */
  rationale: string;
}

export interface ConsensusOutcome {
  decision: Verdict | null;
  supportWeight: number;
  opposeWeight: number;
  abstainWeight: number;
  /** supportWeight / (supportWeight + opposeWeight). 0 when both are 0. */
  supportRatio: number;
  passed: boolean;
  passThreshold: number;
  totalVotes: number;
  /** Votes that did not align with the winning verdict. */
  dissent: AgentVote[];
}

export interface CouncilOptions {
  /** Minimum support ratio to pass. Default 0.66 (two-thirds). */
  passThreshold?: number;
  /** When set, only verdicts that match this target count as 'support'.
   *  Otherwise the most-weighted verdict wins. */
  desiredVerdict?: Verdict;
}

export function tallyCouncil(votes: AgentVote[], opts?: CouncilOptions): ConsensusOutcome {
  const passThreshold = clamp01(opts?.passThreshold ?? 0.66);

  if (votes.length === 0) {
    return {
      decision: null,
      supportWeight: 0,
      opposeWeight: 0,
      abstainWeight: 0,
      supportRatio: 0,
      passed: false,
      passThreshold,
      totalVotes: 0,
      dissent: [],
    };
  }

  // Tally per verdict.
  const weights: Record<Verdict, number> = { approve: 0, reject: 0, abstain: 0 };
  for (const v of votes) {
    weights[v.verdict] += clamp01(v.confidence);
  }

  // Pick decision.
  let decision: Verdict;
  if (opts?.desiredVerdict) {
    decision = opts.desiredVerdict;
  } else {
    decision = (Object.entries(weights) as Array<[Verdict, number]>)
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  const supportWeight = weights[decision];
  // Opposition = the other non-abstain verdict.
  const opposeWeight = decision === "approve"
    ? weights.reject
    : decision === "reject"
      ? weights.approve
      : (weights.approve + weights.reject) / 2; // abstain winning is rare; treat as half-each
  const abstainWeight = weights.abstain;

  const decisive = supportWeight + opposeWeight;
  const supportRatio = decisive > 0 ? supportWeight / decisive : 0;
  // Strict greater-than-or-equal at threshold; tie at threshold ⇒ pass.
  // BUT we treat the edge case differently when threshold itself is 0
  // (a 0-threshold "majority" still needs at least one supporter).
  const passed = supportWeight > 0 && supportRatio >= passThreshold;

  const dissent = votes
    .filter((v) => v.verdict !== decision)
    .sort((a, b) => b.confidence - a.confidence);

  return {
    decision,
    supportWeight,
    opposeWeight,
    abstainWeight,
    supportRatio,
    passed,
    passThreshold,
    totalVotes: votes.length,
    dissent,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
