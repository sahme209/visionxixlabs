/**
 * Phase 516 — AI-Native Advisor Voter.
 *
 * The fourth voter on the council that actually calls Claude (via
 * the platform's existing AIProviderManager). Same inputs the rule
 * voters see, but the AI reasons in natural language and returns a
 * structured kind/confidence/rationale vote.
 *
 * Key invariants:
 *   • Always returns a vote — never throws — never blocks the council.
 *   • Hard fallback to the rule-based voter when the API fails.
 *   • Every prompt + response cached by input fingerprint so repeat
 *     runs in a tick are cheap.
 *   • Returns deterministic-shaped output (CouncilVote) — the rest
 *     of the council aggregator doesn't know it's AI-backed.
 *
 * The AI's job is to second-guess the rule-based voter on edge cases
 * the rules miss: subtle wording in incident titles, unusual signal
 * combinations, contextual cues like "patch tuesday hotfix" in the
 * release summary that hint at urgency the rules don't capture.
 */

import "server-only";
import {
  getAIProviderManager,
} from "@/lib/ai/AIProviderManager";
import {
  ruleBasedVoter,
  type AdvisorVoter,
  type CouncilVote,
} from "./advisorCouncilEngine";
import { RECOMMENDATION_KINDS, type AdvisorInputs, type RecommendationKind } from "./releaseAdvisorEngine";

/* ──────────────────────────────────────────────────────────────────
   In-memory cache.
   ────────────────────────────────────────────────────────────── */

interface CachedVote {
  vote: CouncilVote;
  cachedAtMs: number;
}

const CACHE = new Map<string, CachedVote>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function fingerprint(input: AdvisorInputs): string {
  // Deterministic fingerprint of every signal the voter sees. now is
  // excluded so quasi-identical runs within the TTL share the cache.
  const subset = {
    release: { status: input.release.status, releaseTag: input.release.releaseTag, commitSha: input.release.commitSha },
    readiness: input.readiness,
    policyViolations: input.policyViolations,
    pendingManualFixes: input.pendingManualFixes,
    recentIncidents: input.recentIncidents,
    branchProtection: input.branchProtection,
    previousReleaseStatus: input.previousReleaseStatus,
    hasEvidencePack: input.hasEvidencePack,
    isInPlannedFreeze: input.isInPlannedFreeze,
  };
  return JSON.stringify(subset);
}

/* ──────────────────────────────────────────────────────────────────
   Prompt + parsing.
   ────────────────────────────────────────────────────────────── */

function buildPrompt(input: AdvisorInputs): string {
  const r = input.readiness;
  const lines: string[] = [
    "You are an AI release-operations expert assisting a council that recommends one of the following kinds for a release:",
    `  - block_deploy: hard block, refuse to proceed`,
    `  - rollback: consider rolling back the prior release before going forward`,
    `  - needs_evidence: require evidence before proceeding (e.g. manual-fix reconciliation)`,
    `  - propose_freeze: pause new deploys until things calm down`,
    `  - proceed_with_caution: ship, but monitor closely`,
    `  - propose_manual_fix_log: ask the operator to log out-of-band fixes`,
    `  - propose_branch_protection_strengthen: tighten branch protection`,
    `  - proceed: clear to deploy`,
    "",
    "Read the release state below and decide which single kind best fits.",
    "Reply with a JSON object of shape { kind, confidence, rationale } where:",
    "  - kind is exactly one of the 8 strings above",
    "  - confidence is an integer 0-100",
    "  - rationale is a single concise sentence explaining your call",
    "",
    "Release state:",
    `  status: ${input.release.status}`,
    `  releaseTag: ${input.release.releaseTag ?? "(none)"}`,
    `  isInPlannedFreeze: ${input.isInPlannedFreeze}`,
    `  hasEvidencePack: ${input.hasEvidencePack}`,
    `  previousReleaseStatus: ${input.previousReleaseStatus ?? "(none)"}`,
    "",
    "Readiness:",
    r
      ? `  overallScore: ${r.overallScore}, riskLevel: ${r.riskLevel}, blockers: ${r.blockerCount}, branchGovernance: ${r.branchGovernance}, manualReconciliation: ${r.manualReconciliation}, rollbackReadiness: ${r.rollbackReadiness}`
      : `  (no readiness snapshot)`,
    "",
    "Signals:",
    `  policy violations — blocking: ${input.policyViolations.blocking}, warning: ${input.policyViolations.warning}, advisory: ${input.policyViolations.advisory}`,
    `  pending manual fixes — total: ${input.pendingManualFixes.total}, in prod: ${input.pendingManualFixes.inProd}`,
    `  recent incidents — open: ${input.recentIncidents.open}, open critical: ${input.recentIncidents.openCritical}, mitigated: ${input.recentIncidents.mitigated}`,
    `  branch protection — total snapshots: ${input.branchProtection.snapshotsTotal}, weak/none: ${input.branchProtection.weakOrNone}, force-push on main: ${input.branchProtection.forcePushAllowedOnMain}`,
    "",
    "Respond with ONLY the JSON object. No prose before or after.",
  ];
  return lines.join("\n");
}

/**
 * Parse the model's response into a structured vote. Tolerates loose
 * formatting (extracts the first JSON object found in the text).
 */
export function parseAiVoteResponse(raw: string): { kind: RecommendationKind; confidence: number; rationale: string } | null {
  const trimmed = raw.trim();
  // Extract the first { ... } block.
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return null;
  const slice = trimmed.slice(firstBrace, lastBrace + 1);
  let parsed: unknown;
  try { parsed = JSON.parse(slice); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.kind !== "string") return null;
  const kind = (RECOMMENDATION_KINDS as readonly string[]).includes(p.kind) ? (p.kind as RecommendationKind) : null;
  if (!kind) return null;
  const confidenceRaw = typeof p.confidence === "number" ? p.confidence : Number(p.confidence);
  const confidence = Math.max(0, Math.min(100, Math.round(Number.isFinite(confidenceRaw) ? confidenceRaw : 0)));
  const rationale = typeof p.rationale === "string" ? p.rationale.trim() : "";
  if (!rationale) return null;
  return { kind, confidence, rationale };
}

/* ──────────────────────────────────────────────────────────────────
   Voter implementation.
   ────────────────────────────────────────────────────────────── */

/**
 * Pure wrapper around the AI voter. Caller awaits this to get a vote.
 * Never throws. Returns the rule-based vote tagged with reason on
 * fallback, or the AI's vote tagged with voterId="ai_native" on
 * success.
 */
export async function aiNativeVoterAsync(input: AdvisorInputs): Promise<CouncilVote> {
  // Cache hit?
  const key = fingerprint(input);
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.cachedAtMs < CACHE_TTL_MS) {
    return { ...cached.vote, rationale: `${cached.vote.rationale} (cached)` };
  }

  // Build prompt + call AI.
  const prompt = buildPrompt(input);
  let aiText: string | null = null;
  try {
    const manager = getAIProviderManager();
    const res = await manager.generateText(prompt, {
      maxTokens: 200,
      temperature: 0.2,
    });
    aiText = res.text ?? null;
  } catch (err) {
    return fallbackVote(input, err instanceof Error ? err.message : "ai_provider_error");
  }

  if (!aiText) {
    return fallbackVote(input, "ai_empty_response");
  }

  const parsed = parseAiVoteResponse(aiText);
  if (!parsed) {
    return fallbackVote(input, "ai_unparseable_response");
  }

  const vote: CouncilVote = {
    voterId: "ai_native",
    kind: parsed.kind,
    confidence: parsed.confidence,
    rationale: parsed.rationale,
  };
  CACHE.set(key, { vote, cachedAtMs: Date.now() });
  return vote;
}

function fallbackVote(input: AdvisorInputs, reason: string): CouncilVote {
  const fallback = ruleBasedVoter(input);
  return {
    voterId: "ai_native",
    kind: fallback.kind,
    confidence: Math.max(0, fallback.confidence - 15), // discount confidence on fallback
    rationale: `[AI unavailable, fell back to rules: ${reason}] ${fallback.rationale}`,
  };
}

/**
 * Synchronous adapter that lets the AI voter slot into the existing
 * synchronous AdvisorVoter[] array on the council. We wait for the
 * AI by making the council aggregator's runner aware of async voters
 * (see runAdvisorCouncilAsync below). The plain `AdvisorVoter` shape
 * is preserved for backwards compat — it returns the rule-based vote
 * synchronously and the AI voter runs separately in the async path.
 */
export const aiNativeVoterSync: AdvisorVoter = (input) => {
  // Sync surface returns the rule-based vote as a placeholder.
  // Real AI voting happens through aiNativeVoterAsync + the council
  // generator route that awaits both rule voters and the AI voter.
  const base = ruleBasedVoter(input);
  return {
    voterId: "ai_native",
    kind: base.kind,
    confidence: Math.max(0, base.confidence - 25),
    rationale: `[sync placeholder — call aiNativeVoterAsync for real AI vote] ${base.rationale}`,
  };
};

/* ──────────────────────────────────────────────────────────────────
   Test helpers (exported for unit tests).
   ────────────────────────────────────────────────────────────── */

/** Clear the in-memory cache. Test-only. */
export function __clearAiVoterCache(): void {
  CACHE.clear();
}
