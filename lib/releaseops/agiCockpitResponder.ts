/**
 * Phase 508 — AGI Cockpit composite responder.
 *
 * Single fan-in endpoint that powers the headline AGI dashboard.
 * Merges:
 *   • top pending advisor recommendations across all releases
 *   • top pending policy proposals
 *   • engine telemetry (versions + last-run timestamps + decision
 *     velocity)
 *
 * Pure with respect to its repo dependency. No business logic — just
 * a unified projection over existing tables.
 */

import { isMissingTable } from "./releaseListResponder";
import { ENGINE_VERSION as ADVISOR_ENGINE_VERSION } from "./releaseAdvisorEngine";
import { POLICY_PROPOSAL_ENGINE_VERSION } from "./policyProposalEngine";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface PendingRecommendationRow {
  id: string;
  releaseId: string;
  kind: string;
  title: string;
  rationale: string;
  confidence: number;
  severity: string;
  generatedAt: Date;
}

export interface PendingProposalRow {
  id: string;
  kind: string;
  suggestedRuleKey: string;
  title: string;
  rationale: string;
  confidence: number;
  severity: string;
  generatedAt: Date;
}

export interface PendingSuggestionRow {
  id: string;
  kind: string;
  title: string;
  rationale: string;
  targetKind: string | null;
  targetId: string | null;
  confidence: number;
  generatedAt: Date;
}

export interface AvailabilityRow {
  outcome: string;
}

export interface AgiCockpitRepo {
  advisorRecommendation: {
    findMany(args: {
      where: { organizationId: string; operatorDecision: "pending" };
      orderBy: Array<{ severity: "desc" } | { confidence: "desc" } | { generatedAt: "desc" }>;
      take: number;
    }): Promise<PendingRecommendationRow[]>;
    count(args: { where: { organizationId: string; operatorDecision: string } }): Promise<number>;
    findFirst(args: {
      where: { organizationId: string };
      orderBy: { generatedAt: "desc" };
    }): Promise<{ generatedAt: Date } | null>;
  };
  policyProposal: {
    findMany(args: {
      where: { organizationId: string; operatorDecision: "pending" };
      orderBy: Array<{ severity: "desc" } | { confidence: "desc" } | { generatedAt: "desc" }>;
      take: number;
    }): Promise<PendingProposalRow[]>;
    count(args: { where: { organizationId: string; operatorDecision: string } }): Promise<number>;
    findFirst(args: {
      where: { organizationId: string };
      orderBy: { generatedAt: "desc" };
    }): Promise<{ generatedAt: Date } | null>;
  };
  /** Phase 528 — Optional. When present, the cockpit surfaces pending
   *  proactive suggestions + acceptance counts. When absent, the
   *  suggestions block is omitted from the response (backwards-compat
   *  with deployments pre-Phase-525). */
  proactiveAgiSuggestion?: {
    findMany(args: {
      where: { organizationId: string; operatorDecision: "pending" };
      orderBy: Array<{ confidence: "desc" } | { generatedAt: "desc" }>;
      take: number;
    }): Promise<PendingSuggestionRow[]>;
    count(args: { where: { organizationId: string; operatorDecision: string } }): Promise<number>;
    findFirst(args: {
      where: { organizationId: string };
      orderBy: { generatedAt: "desc" };
    }): Promise<{ generatedAt: Date } | null>;
  };
  /** Phase 528 — Optional. When present, the cockpit surfaces AI
   *  availability over the recent rationale window. */
  aiRationaleEnrichment?: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { generatedAt: "desc" };
      take: number;
    }): Promise<AvailabilityRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface CockpitRecommendation {
  id: string;
  releaseId: string;
  kind: string;
  title: string;
  rationale: string;
  confidence: number;
  severity: string;
  generatedAtIso: string;
}

export interface CockpitProposal {
  id: string;
  kind: string;
  suggestedRuleKey: string;
  title: string;
  rationale: string;
  confidence: number;
  severity: string;
  generatedAtIso: string;
}

export interface CockpitSuggestion {
  id: string;
  kind: string;
  title: string;
  rationale: string;
  targetKind: string | null;
  targetId: string | null;
  confidence: number;
  generatedAtIso: string;
}

export interface AvailabilitySnapshot {
  windowSize: number;
  aiGenerated: number;
  fallbackRules: number;
  errored: number;
  aiAvailabilityPct: number;
}

export interface EngineTelemetry {
  name: string;
  version: string;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  lastRunIso: string | null;
}

export type CockpitBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        engines: {
          advisor: EngineTelemetry;
          policyProposal: EngineTelemetry;
          /** Phase 528 — present when the proactiveAgiSuggestion repo
           *  is wired into the cockpit. Absent on legacy deployments. */
          proactiveSuggestion?: EngineTelemetry;
        };
        topRecommendations: CockpitRecommendation[];
        topProposals: CockpitProposal[];
        /** Phase 528 — top pending proactive suggestions, sorted by
         *  confidence desc then generatedAt desc. Empty array when the
         *  repo isn't wired in. */
        topSuggestions: CockpitSuggestion[];
        /** Phase 528 — AI availability across the recent rationale
         *  window. null when the aiRationaleEnrichment repo isn't
         *  wired in. */
        aiAvailability: AvailabilitySnapshot | null;
        headline: {
          totalPending: number;
          highestSeverity: "low" | "medium" | "high" | "critical" | "none";
          callToAction: string;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface CockpitResult { status: number; body: CockpitBody }

/* ──────────────────────────────────────────────────────────────────
   Severity ranking helper.
   ────────────────────────────────────────────────────────────── */

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };

function headlineSeverity(rows: Array<{ severity: string }>): "low" | "medium" | "high" | "critical" | "none" {
  if (rows.length === 0) return "none";
  let max = 0;
  let label: "low" | "medium" | "high" | "critical" | "none" = "low";
  for (const r of rows) {
    const rank = SEVERITY_RANK[r.severity] ?? 0;
    if (rank > max) {
      max = rank;
      if (rank === 4) label = "critical";
      else if (rank === 3) label = "high";
      else if (rank === 2) label = "medium";
      else if (rank === 1) label = "low";
    }
  }
  return label;
}

function makeCallToAction(severity: "low" | "medium" | "high" | "critical" | "none", totalPending: number): string {
  if (totalPending === 0) return "All clear. Generate recommendations or proposals when you want a fresh AI scan.";
  if (severity === "critical") return `${totalPending} pending — including critical items. Triage these first.`;
  if (severity === "high") return `${totalPending} pending. Review the high-severity items before the next deploy.`;
  if (severity === "medium") return `${totalPending} pending. Worth a calm review.`;
  return `${totalPending} pending. Light touch — no urgency.`;
}

/* ──────────────────────────────────────────────────────────────────
   Responder.
   ────────────────────────────────────────────────────────────── */

export async function buildAgiCockpitResponse(
  repo: AgiCockpitRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<CockpitResult> {
  try {
    const now = opts.now ?? new Date();

    const [recs, recsAccepted, recsRejected, recsLast] = await Promise.all([
      safeMany(() => repo.advisorRecommendation.findMany({
        where: { organizationId, operatorDecision: "pending" },
        orderBy: [{ severity: "desc" }, { confidence: "desc" }, { generatedAt: "desc" }],
        take: 5,
      })),
      safeCount(() => repo.advisorRecommendation.count({ where: { organizationId, operatorDecision: "accepted" } })),
      safeCount(() => repo.advisorRecommendation.count({ where: { organizationId, operatorDecision: "rejected" } })),
      safeRow(() => repo.advisorRecommendation.findFirst({ where: { organizationId }, orderBy: { generatedAt: "desc" } })),
    ]);
    const recsPending = recs.length;

    const [props, propsAccepted, propsRejected, propsLast] = await Promise.all([
      safeMany(() => repo.policyProposal.findMany({
        where: { organizationId, operatorDecision: "pending" },
        orderBy: [{ severity: "desc" }, { confidence: "desc" }, { generatedAt: "desc" }],
        take: 5,
      })),
      safeCount(() => repo.policyProposal.count({ where: { organizationId, operatorDecision: "accepted" } })),
      safeCount(() => repo.policyProposal.count({ where: { organizationId, operatorDecision: "rejected" } })),
      safeRow(() => repo.policyProposal.findFirst({ where: { organizationId }, orderBy: { generatedAt: "desc" } })),
    ]);

    // Phase 528 — optional proactive suggestions block. Reads are
    // best-effort: a missing repo (legacy deployment), a missing table
    // (migration pending), or any other read failure cleanly degrades
    // to an empty suggestions list.
    let suggPending = 0;
    let suggAccepted = 0;
    let suggDismissed = 0;
    let suggLastIso: string | null = null;
    let topSuggestions: CockpitSuggestion[] = [];
    if (repo.proactiveAgiSuggestion) {
      const repoSugg = repo.proactiveAgiSuggestion;
      const [pending, accepted, dismissed, last] = await Promise.all([
        safeMany(() => repoSugg.findMany({
          where: { organizationId, operatorDecision: "pending" },
          orderBy: [{ confidence: "desc" }, { generatedAt: "desc" }],
          take: 5,
        })),
        safeCount(() => repoSugg.count({ where: { organizationId, operatorDecision: "acted" } })),
        safeCount(() => repoSugg.count({ where: { organizationId, operatorDecision: "dismissed" } })),
        safeRow(() => repoSugg.findFirst({ where: { organizationId }, orderBy: { generatedAt: "desc" } })),
      ]);
      suggPending = pending.length;
      suggAccepted = accepted;
      suggDismissed = dismissed;
      suggLastIso = last ? last.generatedAt.toISOString() : null;
      topSuggestions = pending.map((s) => ({
        id: s.id,
        kind: s.kind,
        title: s.title,
        rationale: s.rationale,
        targetKind: s.targetKind,
        targetId: s.targetId,
        confidence: s.confidence,
        generatedAtIso: s.generatedAt.toISOString(),
      }));
    }

    // Phase 528 — AI availability over the last 50 rationale entries.
    let aiAvailability: AvailabilitySnapshot | null = null;
    if (repo.aiRationaleEnrichment) {
      const repoAvail = repo.aiRationaleEnrichment;
      const rows = await safeMany(() => repoAvail.findMany({
        where: { organizationId },
        orderBy: { generatedAt: "desc" },
        take: 50,
      }));
      let aiGenerated = 0;
      let fallbackRules = 0;
      let errored = 0;
      for (const r of rows) {
        if (r.outcome === "ai_generated") aiGenerated++;
        else if (r.outcome === "fallback_rules") fallbackRules++;
        else if (r.outcome === "error") errored++;
      }
      const windowSize = rows.length;
      const aiAvailabilityPct = windowSize === 0 ? 0 : Math.round((aiGenerated / windowSize) * 100);
      aiAvailability = { windowSize, aiGenerated, fallbackRules, errored, aiAvailabilityPct };
    }

    // Suggestions count toward totalPending so the headline reflects
    // the operator's true backlog. Only excluded when suggestion repo
    // wasn't wired (legacy deployments) — in that case suggPending = 0.
    const totalPending = recs.length + props.length + suggPending;
    const allSeverities = [
      ...recs.map((r) => ({ severity: r.severity })),
      ...props.map((p) => ({ severity: p.severity })),
      // Suggestions don't carry a severity column; map confidence
      // bands to severities so they fold into the headline correctly.
      ...topSuggestions.map((s) => ({ severity: s.confidence >= 80 ? "high" : s.confidence >= 60 ? "medium" : "low" })),
    ];
    const severity = headlineSeverity(allSeverities);

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          engines: {
            advisor: {
              name: "Release Advisor",
              version: ADVISOR_ENGINE_VERSION,
              pendingCount: recsPending,
              acceptedCount: recsAccepted,
              rejectedCount: recsRejected,
              lastRunIso: recsLast ? recsLast.generatedAt.toISOString() : null,
            },
            policyProposal: {
              name: "Policy Proposal",
              version: POLICY_PROPOSAL_ENGINE_VERSION,
              pendingCount: props.length,
              acceptedCount: propsAccepted,
              rejectedCount: propsRejected,
              lastRunIso: propsLast ? propsLast.generatedAt.toISOString() : null,
            },
            ...(repo.proactiveAgiSuggestion
              ? {
                  proactiveSuggestion: {
                    name: "Proactive Suggestion",
                    version: "proactive-suggestion-v1.0.0",
                    pendingCount: suggPending,
                    acceptedCount: suggAccepted,
                    rejectedCount: suggDismissed,
                    lastRunIso: suggLastIso,
                  },
                }
              : {}),
          },
          topRecommendations: recs.map((r) => ({
            id: r.id,
            releaseId: r.releaseId,
            kind: r.kind,
            title: r.title,
            rationale: r.rationale,
            confidence: r.confidence,
            severity: r.severity,
            generatedAtIso: r.generatedAt.toISOString(),
          })),
          topProposals: props.map((p) => ({
            id: p.id,
            kind: p.kind,
            suggestedRuleKey: p.suggestedRuleKey,
            title: p.title,
            rationale: p.rationale,
            confidence: p.confidence,
            severity: p.severity,
            generatedAtIso: p.generatedAt.toISOString(),
          })),
          topSuggestions,
          aiAvailability,
          headline: {
            totalPending,
            highestSeverity: severity,
            callToAction: makeCallToAction(severity, totalPending),
          },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "AGI cockpit reads from AdvisorRecommendation + PolicyProposal — one of those tables is missing." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

async function safeMany<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return []; throw err; }
}

async function safeCount(fn: () => Promise<number>): Promise<number> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return 0; throw err; }
}

async function safeRow<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return null; throw err; }
}
