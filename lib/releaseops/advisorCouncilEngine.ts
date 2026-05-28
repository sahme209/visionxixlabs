/**
 * Phase 514 — AGI Council engine.
 *
 * Multi-voter consensus over advisor inputs. Three concrete voters:
 *
 *   • ruleBasedVoter        — wraps the existing release-advisor
 *     engine. The deterministic baseline.
 *   • conservativeVoter     — biases toward block_deploy / caution.
 *     Models a risk-averse SRE perspective.
 *   • pragmaticVoter        — biases toward proceed when no clear
 *     blocker. Models a "ship it" engineering perspective.
 *
 * The aggregator runs all voters, picks the consensus by majority
 * kind (weighted by confidence), and emits an agreement score plus
 * a synthesized rationale citing the majority + the dissent.
 *
 * Operators see WHY the engines agreed or disagreed — and the
 * learning loop can cluster persistent dissent patterns to suggest
 * tuning specific voters.
 */

import {
  generateRecommendations,
  RECOMMENDATION_KINDS,
  type AdvisorInputs,
  type Recommendation,
  type RecommendationKind,
} from "./releaseAdvisorEngine";

export const COUNCIL_ENGINE_VERSION = "advisor-council-v1.0.0";

/* ──────────────────────────────────────────────────────────────────
   Voter contract.
   ────────────────────────────────────────────────────────────── */

export interface CouncilVote {
  voterId: string;
  kind: RecommendationKind;
  confidence: number;        // 0-100
  rationale: string;
}

export type AdvisorVoter = (input: AdvisorInputs) => CouncilVote;

/* ──────────────────────────────────────────────────────────────────
   Concrete voters.
   ────────────────────────────────────────────────────────────── */

/**
 * Rule-based: wraps the existing release-advisor engine. Whatever
 * the primary recommendation kind is, that's this voter's vote.
 */
export const ruleBasedVoter: AdvisorVoter = (input) => {
  const out = generateRecommendations(input);
  const top = out.primary ?? out.recommendations[0];
  return {
    voterId: "rule_based",
    kind: top?.kind ?? "proceed",
    confidence: top?.confidence ?? 60,
    rationale: top?.rationale ?? "No top recommendation surfaced — defaulting to proceed.",
  };
};

/**
 * Conservative: weights blocking signals more heavily, dissents from
 * any "proceed" call unless readiness is genuinely high. Models a
 * risk-averse SRE who'd rather call a false-positive caution than
 * miss a real issue.
 */
export const conservativeVoter: AdvisorVoter = (input) => {
  // Highest-priority blockers — always reflect operator state if present.
  if (input.policyViolations.blocking > 0) {
    return {
      voterId: "conservative",
      kind: "block_deploy",
      confidence: 90,
      rationale: `Blocking policy violations present (${input.policyViolations.blocking}). Conservative voter calls block regardless of other signals.`,
    };
  }
  if (input.readiness && input.readiness.riskLevel === "critical") {
    return {
      voterId: "conservative",
      kind: "block_deploy",
      confidence: 85,
      rationale: `Readiness risk is "critical". Conservative voter calls block.`,
    };
  }
  if (input.previousReleaseStatus === "rolled_back" || input.previousReleaseStatus === "failed") {
    return {
      voterId: "conservative",
      kind: "rollback",
      confidence: 75,
      rationale: `Previous release ended in "${input.previousReleaseStatus}". Conservative voter wants confirmation the regression isn't re-deployed.`,
    };
  }
  if (input.pendingManualFixes.inProd > 0) {
    return {
      voterId: "conservative",
      kind: "needs_evidence",
      confidence: 80,
      rationale: `${input.pendingManualFixes.inProd} pending prod manual fix(es). Conservative voter wants evidence before proceeding.`,
    };
  }
  if (input.recentIncidents.openCritical > 0) {
    return {
      voterId: "conservative",
      kind: "propose_freeze",
      confidence: 75,
      rationale: `Open critical incidents in the recent window. Conservative voter proposes freeze.`,
    };
  }
  if (input.readiness && (input.readiness.overallScore < 80 || input.readiness.riskLevel === "high")) {
    return {
      voterId: "conservative",
      kind: "proceed_with_caution",
      confidence: 70,
      rationale: `Readiness ${input.readiness.overallScore}/100, risk ${input.readiness.riskLevel}. Conservative voter wants explicit caution recorded.`,
    };
  }
  // Even on clean state, conservative dissents from full-proceed unless very high readiness.
  if (input.readiness && input.readiness.overallScore >= 90) {
    return {
      voterId: "conservative",
      kind: "proceed",
      confidence: 75,
      rationale: `Readiness ${input.readiness.overallScore}/100 is high. Conservative voter concedes to proceed.`,
    };
  }
  return {
    voterId: "conservative",
    kind: "proceed_with_caution",
    confidence: 60,
    rationale: "Conservative voter prefers caution unless readiness is overwhelmingly high.",
  };
};

/**
 * Pragmatic: looks for hard blockers; if absent, proceeds. Models a
 * "ship it" engineer who treats medium-severity signals as noise.
 */
export const pragmaticVoter: AdvisorVoter = (input) => {
  // Pragmatic still respects hard blockers — but a single warning
  // policy violation or open low-severity incident is NOT a blocker.
  if (input.policyViolations.blocking >= 2) {
    return {
      voterId: "pragmatic",
      kind: "block_deploy",
      confidence: 80,
      rationale: `${input.policyViolations.blocking} blocking violations is too many to ignore. Pragmatic voter blocks.`,
    };
  }
  if (input.readiness && input.readiness.riskLevel === "critical" && input.readiness.blockerCount >= 2) {
    return {
      voterId: "pragmatic",
      kind: "block_deploy",
      confidence: 75,
      rationale: `Readiness critical with ${input.readiness.blockerCount} blockers. Pragmatic voter blocks.`,
    };
  }
  if (input.recentIncidents.openCritical >= 2) {
    return {
      voterId: "pragmatic",
      kind: "propose_freeze",
      confidence: 65,
      rationale: `Multiple open critical incidents — even pragmatic voter calls for freeze.`,
    };
  }
  // Otherwise: proceed. Pragmatic accepts the existence of imperfect
  // state if no hard blocker exists.
  if (input.readiness && input.readiness.overallScore >= 70) {
    return {
      voterId: "pragmatic",
      kind: "proceed",
      confidence: 85,
      rationale: `Readiness ${input.readiness.overallScore}/100, no critical blocker. Pragmatic voter proceeds — shipping incrementally beats perfect-state paralysis.`,
    };
  }
  if (input.readiness && input.readiness.overallScore >= 50) {
    return {
      voterId: "pragmatic",
      kind: "proceed_with_caution",
      confidence: 65,
      rationale: `Readiness ${input.readiness.overallScore}/100 — proceed with monitoring rather than block.`,
    };
  }
  return {
    voterId: "pragmatic",
    kind: "proceed",
    confidence: 55,
    rationale: "No clear blocker. Pragmatic voter accepts uncertainty and proceeds.",
  };
};

/**
 * Default council — all three voters. Callers can swap this for
 * custom voter sets (e.g. to A/B test new voters).
 */
export const DEFAULT_COUNCIL: AdvisorVoter[] = [ruleBasedVoter, conservativeVoter, pragmaticVoter];

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface CouncilDecision {
  engineVersion: string;
  generatedAtIso: string;
  consensusKind: RecommendationKind | "no_consensus";
  agreementScore: number;       // 0-100
  title: string;
  rationale: string;
  votes: CouncilVote[];
  voterCount: number;
}

/* ──────────────────────────────────────────────────────────────────
   Aggregator.
   ────────────────────────────────────────────────────────────── */

const KIND_TITLES: Record<RecommendationKind, string> = {
  block_deploy: "Council: Block deploy",
  rollback: "Council: Consider rollback",
  needs_evidence: "Council: Evidence required",
  propose_freeze: "Council: Propose freeze",
  proceed_with_caution: "Council: Proceed with caution",
  propose_manual_fix_log: "Council: Log manual fix",
  propose_branch_protection_strengthen: "Council: Strengthen protection",
  proceed: "Council: Proceed",
};

/**
 * Run the council, aggregate votes by kind, compute consensus + agreement.
 *
 * Consensus rule: the kind whose votes' summed confidence is highest
 * wins. If no kind has strictly more than half the total confidence
 * weight, consensus is "no_consensus" (operator must decide).
 */
export function runAdvisorCouncil(
  input: AdvisorInputs,
  voters: AdvisorVoter[] = DEFAULT_COUNCIL,
): CouncilDecision {
  const votes: CouncilVote[] = [];
  for (const v of voters) {
    try {
      const vote = v(input);
      // Defensive: clamp kind to closed-union.
      const k = (RECOMMENDATION_KINDS as readonly string[]).includes(vote.kind) ? vote.kind : "proceed";
      const c = Math.max(0, Math.min(100, vote.confidence));
      votes.push({ voterId: vote.voterId, kind: k as RecommendationKind, confidence: c, rationale: vote.rationale });
    } catch (err) {
      votes.push({
        voterId: "errored_voter",
        kind: "proceed",
        confidence: 0,
        rationale: `Voter threw: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  // Tally weighted by confidence.
  const weights = new Map<RecommendationKind, number>();
  let totalWeight = 0;
  for (const vote of votes) {
    weights.set(vote.kind, (weights.get(vote.kind) ?? 0) + vote.confidence);
    totalWeight += vote.confidence;
  }

  // Find majority.
  let topKind: RecommendationKind = "proceed";
  let topWeight = 0;
  for (const [k, w] of weights.entries()) {
    if (w > topWeight) { topKind = k; topWeight = w; }
  }

  // Strict majority: > 50% of total weight.
  const isStrictMajority = totalWeight > 0 && topWeight > totalWeight / 2;
  const consensusKind: RecommendationKind | "no_consensus" = isStrictMajority ? topKind : "no_consensus";

  // Agreement score: top kind's weight / total weight, scaled to 0-100.
  const agreementScore = totalWeight === 0 ? 0 : Math.round((topWeight / totalWeight) * 100);

  // Synthesize rationale.
  const dissentVoters = votes.filter((v) => v.kind !== topKind);
  const majorityVoters = votes.filter((v) => v.kind === topKind);

  let rationale: string;
  if (consensusKind === "no_consensus") {
    const breakdown = Array.from(weights.entries()).map(([k, w]) => `${k} (${w}pt)`).join(", ");
    rationale = `No strict majority. Vote distribution: ${breakdown}. Operator must decide.`;
  } else {
    const majSummary = majorityVoters.map((v) => `${v.voterId}: ${v.confidence}% — "${truncate(v.rationale, 80)}"`).join(" | ");
    const dissentSummary = dissentVoters.length === 0
      ? "All voters agreed."
      : `Dissent: ${dissentVoters.map((v) => `${v.voterId} voted ${v.kind} (${v.confidence}%) — "${truncate(v.rationale, 60)}"`).join("; ")}`;
    rationale = `${majoritySummaryPrefix(consensusKind, majorityVoters.length, votes.length)} ${majSummary}. ${dissentSummary}`;
  }

  const title = consensusKind === "no_consensus"
    ? "Council: No consensus — operator decides"
    : KIND_TITLES[consensusKind];

  return {
    engineVersion: COUNCIL_ENGINE_VERSION,
    generatedAtIso: input.now.toISOString(),
    consensusKind,
    agreementScore,
    title,
    rationale,
    votes,
    voterCount: voters.length,
  };
}

function majoritySummaryPrefix(kind: RecommendationKind, majCount: number, totalCount: number): string {
  return `${majCount}/${totalCount} voters agreed on ${kind}.`;
}

/* ──────────────────────────────────────────────────────────────────
   Phase 516 — Async council with AI-native voter.
   ────────────────────────────────────────────────────────────── */

/**
 * Async voter — returns a promise of a vote. Used for the
 * AI-native voter (Claude API) and any future voter that needs I/O.
 */
export type AsyncAdvisorVoter = (input: AdvisorInputs) => Promise<CouncilVote>;

/**
 * Run the council with a mix of sync (rule-based) voters and async
 * (AI-backed) voters. The async voters are executed in parallel.
 * Failures in any voter degrade to "errored_voter" — never abort
 * the council.
 */
export async function runAdvisorCouncilAsync(
  input: AdvisorInputs,
  syncVoters: AdvisorVoter[] = DEFAULT_COUNCIL,
  asyncVoters: AsyncAdvisorVoter[] = [],
): Promise<CouncilDecision> {
  // Run sync voters synchronously (their failures already captured by
  // the existing runAdvisorCouncil function — we replicate the same
  // tolerance here).
  const syncVotes: CouncilVote[] = [];
  for (const v of syncVoters) {
    try {
      const vote = v(input);
      const k = (RECOMMENDATION_KINDS as readonly string[]).includes(vote.kind) ? vote.kind : "proceed";
      const c = Math.max(0, Math.min(100, vote.confidence));
      syncVotes.push({ voterId: vote.voterId, kind: k as RecommendationKind, confidence: c, rationale: vote.rationale });
    } catch (err) {
      syncVotes.push({
        voterId: "errored_voter",
        kind: "proceed",
        confidence: 0,
        rationale: `Sync voter threw: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  // Run async voters in parallel; capture their exceptions.
  const asyncSettled = await Promise.allSettled(asyncVoters.map((v) => v(input)));
  const asyncVotes: CouncilVote[] = asyncSettled.map((r) => {
    if (r.status === "fulfilled") {
      const vote = r.value;
      const k = (RECOMMENDATION_KINDS as readonly string[]).includes(vote.kind) ? vote.kind : "proceed";
      const c = Math.max(0, Math.min(100, vote.confidence));
      return { voterId: vote.voterId, kind: k as RecommendationKind, confidence: c, rationale: vote.rationale };
    }
    return {
      voterId: "errored_voter",
      kind: "proceed",
      confidence: 0,
      rationale: `Async voter threw: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
    };
  });

  const votes = [...syncVotes, ...asyncVotes];

  // Same aggregation as runAdvisorCouncil.
  const weights = new Map<RecommendationKind, number>();
  let totalWeight = 0;
  for (const vote of votes) {
    weights.set(vote.kind, (weights.get(vote.kind) ?? 0) + vote.confidence);
    totalWeight += vote.confidence;
  }

  let topKind: RecommendationKind = "proceed";
  let topWeight = 0;
  for (const [k, w] of weights.entries()) {
    if (w > topWeight) { topKind = k; topWeight = w; }
  }

  const isStrictMajority = totalWeight > 0 && topWeight > totalWeight / 2;
  const consensusKind: RecommendationKind | "no_consensus" = isStrictMajority ? topKind : "no_consensus";
  const agreementScore = totalWeight === 0 ? 0 : Math.round((topWeight / totalWeight) * 100);

  const dissentVoters = votes.filter((v) => v.kind !== topKind);
  const majorityVoters = votes.filter((v) => v.kind === topKind);

  let rationale: string;
  if (consensusKind === "no_consensus") {
    const breakdown = Array.from(weights.entries()).map(([k, w]) => `${k} (${w}pt)`).join(", ");
    rationale = `No strict majority. Vote distribution: ${breakdown}. Operator must decide.`;
  } else {
    const majSummary = majorityVoters.map((v) => `${v.voterId}: ${v.confidence}% — "${truncate(v.rationale, 80)}"`).join(" | ");
    const dissentSummary = dissentVoters.length === 0
      ? "All voters agreed."
      : `Dissent: ${dissentVoters.map((v) => `${v.voterId} voted ${v.kind} (${v.confidence}%) — "${truncate(v.rationale, 60)}"`).join("; ")}`;
    rationale = `${majoritySummaryPrefix(consensusKind, majorityVoters.length, votes.length)} ${majSummary}. ${dissentSummary}`;
  }

  const title = consensusKind === "no_consensus"
    ? "Council: No consensus — operator decides"
    : KIND_TITLES[consensusKind];

  return {
    engineVersion: COUNCIL_ENGINE_VERSION,
    generatedAtIso: input.now.toISOString(),
    consensusKind,
    agreementScore,
    title,
    rationale,
    votes,
    voterCount: votes.length,
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
