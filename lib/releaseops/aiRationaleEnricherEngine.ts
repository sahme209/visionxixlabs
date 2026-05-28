/**
 * Phase 518 — AI Rationale Enricher (engine).
 *
 * Takes a council decision + the inputs the council saw and produces a
 * natural-language narrative explaining WHY the consensus landed where
 * it did. Three outputs per enrichment:
 *
 *   • narrative       — one short paragraph in plain English
 *   • riskFactors[]   — bulleted list of concrete risks the operator should know about
 *   • nextActions[]   — bulleted list of operator next-steps
 *
 * Designed to be invoked best-effort: when the AI provider is missing,
 * the engine falls back to a deterministic rationale built from the
 * decision's own rule-engine output. The outcome is tagged so the
 * caller can surface "AI generated" vs "Fallback rules" vs "Error" to
 * the operator.
 *
 * Pure function — no I/O, no DB. The caller injects the AI fetcher
 * (so unit tests can stub it).
 */

import type { CouncilDecision, CouncilVote } from "./advisorCouncilEngine";
import { RECOMMENDATION_KINDS, type AdvisorInputs, type RecommendationKind } from "./releaseAdvisorEngine";

export const RATIONALE_ENRICHER_ENGINE_VERSION = "ai-rationale-enricher-v1.0.0";

/** Closed-union enrichment outcome. Pinned on the persisted row. */
export const ENRICHMENT_OUTCOMES = ["ai_generated", "fallback_rules", "error"] as const;
export type EnrichmentOutcome = (typeof ENRICHMENT_OUTCOMES)[number];

export interface RationaleEnrichment {
  outcome: EnrichmentOutcome;
  narrative: string;
  riskFactors: string[];
  nextActions: string[];
  modelHint: string | null;
  errorMessage: string | null;
  engineVersion: string;
}

/**
 * Function signature for the injected AI fetcher. Returns the raw text
 * the model produced, or throws on infrastructure failure. Implementors
 * wrap AIProviderManager.generateText().
 */
export type RationaleAiFetcher = (prompt: string) => Promise<{ text: string; modelHint: string | null }>;

/* ──────────────────────────────────────────────────────────────────
   Prompt construction.
   ────────────────────────────────────────────────────────────── */

export function buildRationalePrompt(decision: CouncilDecision, inputs: AdvisorInputs): string {
  const r = inputs.readiness;
  const lines: string[] = [
    "You are a senior release-operations engineer explaining a council decision to an operator.",
    "Reply with a JSON object of shape { narrative, riskFactors, nextActions } where:",
    `  - narrative is a SINGLE plain-English paragraph (2-4 sentences) explaining the consensus.`,
    `  - riskFactors is an array of 1-5 short strings, each one concrete risk worth flagging.`,
    `  - nextActions is an array of 1-5 short imperative strings, each a concrete operator action.`,
    `  - Each string in the arrays MUST be under 140 characters.`,
    `  - Do NOT recite raw numbers when prose is clearer.`,
    "",
    `Council consensus: ${decision.consensusKind}`,
    `Agreement: ${decision.agreementScore}%`,
    `Synthesized rationale: ${decision.rationale}`,
    "",
    "Voter breakdown:",
    ...decision.votes.map((v) => `  - ${v.voterId}: ${v.kind} @ ${v.confidence}% — ${truncate(v.rationale, 120)}`),
    "",
    "Release state:",
    `  status: ${inputs.release.status}`,
    `  releaseTag: ${inputs.release.releaseTag ?? "(none)"}`,
    `  isInPlannedFreeze: ${inputs.isInPlannedFreeze}`,
    `  hasEvidencePack: ${inputs.hasEvidencePack}`,
    `  previousReleaseStatus: ${inputs.previousReleaseStatus ?? "(none)"}`,
    "",
    "Readiness:",
    r
      ? `  overallScore: ${r.overallScore}, riskLevel: ${r.riskLevel}, blockers: ${r.blockerCount}`
      : `  (no readiness snapshot)`,
    "",
    "Signals:",
    `  policy violations — blocking: ${inputs.policyViolations.blocking}, warning: ${inputs.policyViolations.warning}, advisory: ${inputs.policyViolations.advisory}`,
    `  pending manual fixes — total: ${inputs.pendingManualFixes.total}, in prod: ${inputs.pendingManualFixes.inProd}`,
    `  recent incidents — open: ${inputs.recentIncidents.open}, open critical: ${inputs.recentIncidents.openCritical}`,
    `  branch protection — total: ${inputs.branchProtection.snapshotsTotal}, weak: ${inputs.branchProtection.weakOrNone}`,
    "",
    "Respond with ONLY the JSON object. No prose before or after.",
  ];
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────
   Parsing.
   ────────────────────────────────────────────────────────────── */

interface ParsedRationale {
  narrative: string;
  riskFactors: string[];
  nextActions: string[];
}

/**
 * Tolerant JSON extractor: finds the first {..} block in the response
 * and validates the three required fields. Truncates list items to
 * 140 chars to match the prompt contract.
 */
export function parseRationaleResponse(raw: string): ParsedRationale | null {
  const trimmed = raw.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return null;
  const slice = trimmed.slice(firstBrace, lastBrace + 1);
  let parsed: unknown;
  try { parsed = JSON.parse(slice); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.narrative !== "string" || p.narrative.trim().length === 0) return null;
  if (!Array.isArray(p.riskFactors) || !Array.isArray(p.nextActions)) return null;
  const risk = cleanList(p.riskFactors);
  const next = cleanList(p.nextActions);
  if (risk.length === 0 || next.length === 0) return null;
  return {
    narrative: p.narrative.trim(),
    riskFactors: risk,
    nextActions: next,
  };
}

function cleanList(arr: unknown[]): string[] {
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const s = item.trim();
    if (!s) continue;
    out.push(s.length <= 140 ? s : `${s.slice(0, 139)}…`);
    if (out.length >= 5) break;
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────
   Fallback narrative builder.
   ────────────────────────────────────────────────────────────── */

/**
 * Deterministic fallback used when the AI provider is unavailable or
 * returns unparseable output. Reads the existing council rationale and
 * voter breakdown and assembles a structured-but-non-AI rationale.
 * Caller gets the same shape as the AI path so the UI doesn't branch.
 */
export function buildFallbackRationale(decision: CouncilDecision, inputs: AdvisorInputs, reason: string): RationaleEnrichment {
  const majority = majorityVoters(decision.votes, decision.consensusKind);
  const dissent = decision.votes.filter((v) => v.kind !== decision.consensusKind);

  const narrativeParts: string[] = [];
  if (decision.consensusKind === "no_consensus") {
    narrativeParts.push(`The council failed to reach a strict majority across ${decision.votes.length} voters — operator decision is required.`);
  } else {
    narrativeParts.push(`${majority.length} of ${decision.votes.length} voters agreed on "${decision.consensusKind}" with ${decision.agreementScore}% weighted agreement.`);
  }
  if (dissent.length > 0) {
    narrativeParts.push(`Dissent: ${dissent.map((v) => `${v.voterId} → ${v.kind}`).join(", ")}.`);
  }
  const narrative = narrativeParts.join(" ");

  const riskFactors = listFallbackRisks(decision, inputs);
  const nextActions = listFallbackActions(decision);

  return {
    outcome: "fallback_rules",
    narrative,
    riskFactors,
    nextActions,
    modelHint: null,
    errorMessage: reason,
    engineVersion: RATIONALE_ENRICHER_ENGINE_VERSION,
  };
}

function listFallbackRisks(decision: CouncilDecision, inputs: AdvisorInputs): string[] {
  const out: string[] = [];
  if (inputs.policyViolations.blocking > 0) {
    out.push(`${inputs.policyViolations.blocking} blocking policy violation${inputs.policyViolations.blocking === 1 ? "" : "s"} present.`);
  }
  if (inputs.pendingManualFixes.inProd > 0) {
    out.push(`${inputs.pendingManualFixes.inProd} unreconciled manual fix${inputs.pendingManualFixes.inProd === 1 ? "" : "es"} in production.`);
  }
  if (inputs.recentIncidents.openCritical > 0) {
    out.push(`${inputs.recentIncidents.openCritical} open critical incident${inputs.recentIncidents.openCritical === 1 ? "" : "s"} in the recent window.`);
  }
  if (inputs.branchProtection.forcePushAllowedOnMain) {
    out.push("Force-push is allowed on main — branch protection is weak.");
  }
  if (inputs.readiness && inputs.readiness.overallScore < 70) {
    out.push(`Release readiness score is ${inputs.readiness.overallScore}/100 (risk ${inputs.readiness.riskLevel}).`);
  }
  if (inputs.previousReleaseStatus === "rolled_back" || inputs.previousReleaseStatus === "failed") {
    out.push(`Previous release ended in "${inputs.previousReleaseStatus}" — repeat regression risk.`);
  }
  if (out.length === 0) {
    out.push(decision.consensusKind === "proceed"
      ? "No surfaced risk factors above the alert threshold."
      : "See voter dissent for risk signals not captured here.");
  }
  return out.slice(0, 5);
}

function listFallbackActions(decision: CouncilDecision): string[] {
  const k = decision.consensusKind;
  switch (k) {
    case "block_deploy":
      return [
        "Resolve the cited blocking signals before re-running readiness.",
        "Capture the override decision in the council so the learning loop sees it.",
        "Notify on-call before any manual override.",
      ];
    case "rollback":
      return [
        "Confirm the previous release's last-known-good tag.",
        "Verify rollback automation is in place + tested.",
        "Open an incident ticket if rollback is executed.",
      ];
    case "needs_evidence":
      return [
        "Reconcile every pending manual fix against source-of-truth.",
        "Attach an evidence pack to the release before re-running the council.",
        "Loop in the change ticket reviewer.",
      ];
    case "propose_freeze":
      return [
        "Flip the release-freeze switch for the affected window.",
        "Schedule a freeze-review at the end of the open incident window.",
        "Notify deploy-train owners of the freeze.",
      ];
    case "proceed_with_caution":
      return [
        "Stage the rollout (canary → 25% → 100%) instead of full deploy.",
        "Watch error rates + p99 latency for the next 30 minutes post-deploy.",
        "Have rollback ready in case the canary regresses.",
      ];
    case "propose_manual_fix_log":
      return [
        "Log the manual fix in the platform's reconciliation system.",
        "Tie the fix to its source-of-truth commit when possible.",
        "Re-run the council once the fix is logged.",
      ];
    case "propose_branch_protection_strengthen":
      return [
        "Tighten branch protection: require PR review + signed commits + disable force-push.",
        "Snapshot the new protection and re-run readiness.",
        "Notify the repo owner of the change.",
      ];
    case "proceed":
      return [
        "Proceed with the standard deploy path.",
        "Monitor post-deploy signals for the next 30 minutes.",
        "Confirm the release is published in the audit log.",
      ];
    case "no_consensus":
      return [
        "Operator must decide — review the voter breakdown.",
        "Consider running an extra AI voter (council generate · withAi).",
        "Record the decision so the learning loop can cluster the dissent.",
      ];
    default:
      return ["Operator review required."];
  }
}

function majorityVoters(votes: CouncilVote[], consensusKind: RecommendationKind | "no_consensus"): CouncilVote[] {
  if (consensusKind === "no_consensus") return [];
  return votes.filter((v) => v.kind === consensusKind);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/* ──────────────────────────────────────────────────────────────────
   Engine entrypoint.
   ────────────────────────────────────────────────────────────── */

/**
 * Build an enrichment for the given decision. Never throws. If the AI
 * fetcher returns unparseable output or throws, falls back to the
 * deterministic rule-based rationale.
 */
export async function enrichDecisionRationale(
  decision: CouncilDecision,
  inputs: AdvisorInputs,
  fetcher: RationaleAiFetcher | null,
): Promise<RationaleEnrichment> {
  if (!fetcher) {
    return buildFallbackRationale(decision, inputs, "no_ai_fetcher_configured");
  }

  let raw: string;
  let modelHint: string | null = null;
  try {
    const result = await fetcher(buildRationalePrompt(decision, inputs));
    raw = result.text ?? "";
    modelHint = result.modelHint ?? null;
  } catch (err) {
    return {
      ...buildFallbackRationale(decision, inputs, err instanceof Error ? err.message : "ai_fetcher_threw"),
      outcome: "error",
    };
  }

  if (!raw.trim()) {
    return buildFallbackRationale(decision, inputs, "empty_ai_response");
  }

  const parsed = parseRationaleResponse(raw);
  if (!parsed) {
    return buildFallbackRationale(decision, inputs, "unparseable_ai_response");
  }

  return {
    outcome: "ai_generated",
    narrative: parsed.narrative,
    riskFactors: parsed.riskFactors,
    nextActions: parsed.nextActions,
    modelHint,
    errorMessage: null,
    engineVersion: RATIONALE_ENRICHER_ENGINE_VERSION,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Type guard.
   ────────────────────────────────────────────────────────────── */

export function isEnrichmentOutcome(s: string): s is EnrichmentOutcome {
  return (ENRICHMENT_OUTCOMES as readonly string[]).includes(s);
}

/** Defensive: the closed-union of RecommendationKind isn't used here
 * but re-exported for callers that want to assert on consensusKind. */
export { RECOMMENDATION_KINDS };
