/**
 * Pure multi-agent debate.
 *
 * Input: N typed proposals from independent kernels for the same
 * problem (each with a verdict, confidence, and rationale). Output:
 * a consolidated verdict — agreed / partial_agreement / dissent — and
 * a council-weighted final recommendation, with explicit dissent
 * surfaced so the operator can see WHO disagreed and WHY.
 *
 * Pure / deterministic. Closed unions on every shape so adding a
 * new verdict kind breaks the build.
 *
 * Why this matters for AGI:
 *   A single-kernel proposal is just one model talking. A multi-
 *   kernel debate forces an explicit safety case: if any safety-tier
 *   kernel dissents, the consolidated verdict cannot auto-apply.
 */

export type DebateVerdict = "approve" | "reject" | "needs_more_info" | "escalate";

export type AgentTier = "perception" | "reasoning" | "planning" | "safety" | "verification";

export interface AgentProposal {
  /** Kernel id contributing this proposal. */
  agentId: string;
  /** Closed-union tier — safety dissent is a hard veto. */
  tier: AgentTier;
  /** What this agent thinks should happen. */
  verdict: DebateVerdict;
  /** 0..1 confidence. */
  confidence: number;
  /** Operator-readable rationale. */
  rationale: string;
}

export interface DebateConfig {
  /**
   * Quorum kind. council_2_of_3 / 3_of_5 set the count rule;
   * weighted_majority lets confidence pull the result.
   */
  quorum: "council_2_of_3" | "council_3_of_5" | "weighted_majority" | "unanimous";
  /** Whether a safety-tier reject is a hard veto. Default true. */
  safetyVeto: boolean;
}

export const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  quorum: "council_2_of_3",
  safetyVeto: true,
};

export type ConsensusState =
  | "unanimous_approve"
  | "unanimous_reject"
  | "quorum_approve"
  | "quorum_reject"
  | "partial_agreement"
  | "dissent"
  | "safety_veto";

export interface DebateOutcome {
  /** Final consolidated verdict for the cockpit + approval engine. */
  finalVerdict: DebateVerdict;
  /** Closed-union consensus state. */
  consensus: ConsensusState;
  /** Counts per verdict among the proposals. */
  verdictCounts: Readonly<Record<DebateVerdict, number>>;
  /**
   * Dissenters — agents whose verdict differs from the final.
   * Surface every dissenting voice on the approval card.
   */
  dissenters: ReadonlyArray<{ agentId: string; tier: AgentTier; verdict: DebateVerdict; rationale: string }>;
  /** Operator-readable narrative the cockpit shows above the approval. */
  narrative: string;
  /** Confidence-weighted average for the chosen verdict. */
  weightedConfidence: number;
}

const QUORUM_REQUIREMENT: Record<DebateConfig["quorum"], (n: number) => number> = {
  council_2_of_3:     (n) => n >= 3 ? 2 : Math.ceil(n / 2),
  council_3_of_5:     (n) => n >= 5 ? 3 : Math.ceil(n / 2),
  weighted_majority:  (n) => Math.floor(n / 2) + 1,
  unanimous:          (n) => n,
};

function isApproveVerdict(v: DebateVerdict): boolean {
  return v === "approve";
}

function isRejectVerdict(v: DebateVerdict): boolean {
  return v === "reject";
}

export function reconcileDebate(
  proposals: readonly AgentProposal[],
  config: DebateConfig = DEFAULT_DEBATE_CONFIG,
): DebateOutcome {
  if (proposals.length === 0) {
    return {
      finalVerdict: "needs_more_info",
      consensus: "dissent",
      verdictCounts: { approve: 0, reject: 0, needs_more_info: 0, escalate: 0 },
      dissenters: [],
      narrative: "No proposals submitted — cannot reach a verdict.",
      weightedConfidence: 0,
    };
  }

  const verdictCounts: Record<DebateVerdict, number> = {
    approve: 0, reject: 0, needs_more_info: 0, escalate: 0,
  };
  for (const p of proposals) verdictCounts[p.verdict] += 1;

  const n = proposals.length;
  const required = QUORUM_REQUIREMENT[config.quorum](n);
  const safetyDissent = config.safetyVeto && proposals.some(
    (p) => p.tier === "safety" && isRejectVerdict(p.verdict),
  );

  // ── Safety veto wins above everything ─────────────────────────
  if (safetyDissent) {
    const safetyVoices = proposals.filter((p) => p.tier === "safety" && isRejectVerdict(p.verdict));
    return {
      finalVerdict: "reject",
      consensus: "safety_veto",
      verdictCounts,
      dissenters: proposals
        .filter((p) => !isRejectVerdict(p.verdict))
        .map((p) => ({ agentId: p.agentId, tier: p.tier, verdict: p.verdict, rationale: p.rationale })),
      narrative: `Safety veto: ${safetyVoices.map((v) => v.agentId).join(", ")} rejected — the safety contract refuses to override regardless of other votes.`,
      weightedConfidence: avgConfidence(safetyVoices),
    };
  }

  // ── Weighted majority: confidence weights override raw counts ──
  // Evaluated BEFORE count-based quorum so the weighted-majority
  // mode actually behaves like its name promises.
  if (config.quorum === "weighted_majority") {
    const approveWeight = sumConfidence(proposals, isApproveVerdict);
    const rejectWeight  = sumConfidence(proposals, isRejectVerdict);
    if (approveWeight > rejectWeight && approveWeight > 0) {
      return finalize("approve", "partial_agreement", verdictCounts, proposals);
    }
    if (rejectWeight > approveWeight && rejectWeight > 0) {
      return finalize("reject", "partial_agreement", verdictCounts, proposals);
    }
  }

  // ── Unanimous outcomes ───────────────────────────────────────
  if (verdictCounts.approve === n) {
    return finalize("approve", "unanimous_approve", verdictCounts, proposals);
  }
  if (verdictCounts.reject === n) {
    return finalize("reject", "unanimous_reject", verdictCounts, proposals);
  }

  // ── Quorum-based outcomes ────────────────────────────────────
  if (verdictCounts.approve >= required) {
    const dissenters = proposals.filter((p) => !isApproveVerdict(p.verdict));
    return finalize("approve", dissenters.length > 0 ? "quorum_approve" : "unanimous_approve", verdictCounts, proposals);
  }
  if (verdictCounts.reject >= required) {
    return finalize("reject", "quorum_reject", verdictCounts, proposals);
  }

  // ── No clear quorum + no weighted resolution → dissent ───────
  // If anyone said needs_more_info or escalate, mirror that.
  if (verdictCounts.escalate > 0) {
    return finalize("escalate", "dissent", verdictCounts, proposals);
  }
  if (verdictCounts.needs_more_info > 0) {
    return finalize("needs_more_info", "dissent", verdictCounts, proposals);
  }
  return finalize("needs_more_info", "dissent", verdictCounts, proposals);
}

function finalize(
  finalVerdict: DebateVerdict,
  consensus: ConsensusState,
  verdictCounts: Record<DebateVerdict, number>,
  proposals: readonly AgentProposal[],
): DebateOutcome {
  const dissenters = proposals
    .filter((p) => p.verdict !== finalVerdict)
    .map((p) => ({ agentId: p.agentId, tier: p.tier, verdict: p.verdict, rationale: p.rationale }));
  const winners = proposals.filter((p) => p.verdict === finalVerdict);
  const weightedConfidence = avgConfidence(winners);

  const narrative = buildNarrative(consensus, finalVerdict, proposals.length, dissenters.length);

  return {
    finalVerdict,
    consensus,
    verdictCounts,
    dissenters,
    narrative,
    weightedConfidence,
  };
}

function sumConfidence(proposals: readonly AgentProposal[], filter: (v: DebateVerdict) => boolean): number {
  let total = 0;
  for (const p of proposals) if (filter(p.verdict)) total += p.confidence;
  return total;
}

function avgConfidence(proposals: readonly AgentProposal[]): number {
  if (proposals.length === 0) return 0;
  let s = 0;
  for (const p of proposals) s += p.confidence;
  return Math.round((s / proposals.length) * 1000) / 1000;
}

function buildNarrative(consensus: ConsensusState, verdict: DebateVerdict, total: number, dissent: number): string {
  switch (consensus) {
    case "unanimous_approve":
      return `All ${total} agents approved unanimously.`;
    case "unanimous_reject":
      return `All ${total} agents rejected unanimously.`;
    case "quorum_approve":
      return `Quorum reached: approve. ${dissent} dissenting voice(s) recorded on the approval card.`;
    case "quorum_reject":
      return `Quorum reached: reject. ${dissent} dissenting voice(s) recorded.`;
    case "partial_agreement":
      return `Weighted-confidence majority for ${verdict}. ${dissent} dissenting voice(s) on the card.`;
    case "dissent":
      return `No quorum + no weighted majority. Routing to ${verdict} for human triage. ${dissent} dissenting voice(s).`;
    case "safety_veto":
      return `Safety veto applied — final verdict is reject regardless of other votes.`;
  }
}
