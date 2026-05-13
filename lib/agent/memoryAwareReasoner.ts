/**
 * Memory-aware reasoner — adjusts findings + recommendations based on
 * structured operational memory rules.
 *
 * Wraps the base snapshotReasoner. Memory rules are explicit, auditable,
 * and explainable: every adjustment carries a typed reason that the UI
 * can surface to the user.
 */

import type { CloudSnapshot } from "@/lib/cloud/snapshotModel";
import type { ReasonerOutput, ReasonedRecommendation } from "@/lib/agent/snapshotReasoner";
import { reasonAboutSnapshot } from "@/lib/agent/snapshotReasoner";
import type { MemoryStore, MemoryRecord } from "@/lib/memory/operationalMemory";

// ---------------------------------------------------------------------------
// Memory-driven adjustments
// ---------------------------------------------------------------------------

export type MemoryAdjustmentReason =
  | "recurring_finding"
  | "previously_accepted"
  | "previously_rejected"
  | "previously_deferred"
  | "previous_execution_succeeded"
  | "previous_execution_failed"
  | "previous_rollback_executed"
  | "verification_passed_streak"
  | "verification_failed_recent"
  | "team_prefers_export"
  | "high_recurrence_resource";

export interface MemoryAdjustment {
  recommendationId: string;
  reason: MemoryAdjustmentReason;
  /** Effect on confidence in [-1, 1]. */
  confidenceDelta: number;
  /** Whether approval requirement should escalate (set to required regardless of risk). */
  forceApproval?: boolean;
  /** Whether priority should drop (deprioritize repeatedly-ignored items). */
  deprioritize?: boolean;
  /** Human-readable explanation surfaced in UI. */
  explanation: string;
  /** Evidence — list of memory record IDs that drove this adjustment. */
  evidenceMemoryIds: string[];
}

export interface MemoryAwareOutput extends ReasonerOutput {
  /** Recommendations after memory adjustments are applied. */
  recommendations: ReasonedRecommendation[];
  /** Per-recommendation adjustments — UI surfaces these as "why changed" cards. */
  adjustments: Record<string, MemoryAdjustment[]>;
}

// ---------------------------------------------------------------------------
// Rules — explicit, ordered, auditable
// ---------------------------------------------------------------------------

interface RuleContext {
  organizationId: string;
  store: MemoryStore;
  rec: ReasonedRecommendation;
}

type Rule = (ctx: RuleContext) => Promise<MemoryAdjustment | null>;

const rules: Rule[] = [
  // Rule: recurring finding raises confidence — we've seen this pattern before
  async ({ organizationId, store, rec }) => {
    const resId = ctxResource(rec);
    if (!resId) return null;
    const count = await store.recurringForResource({ organizationId, resourceId: resId, kind: "finding.recurring" });
    if (count < 2) return null;
    return {
      recommendationId: rec.id,
      reason: "recurring_finding",
      confidenceDelta: Math.min(0.1, count * 0.02),
      explanation: `This finding has appeared on this resource ${count} times. Pattern is consistent.`,
      evidenceMemoryIds: [],
    };
  },

  // Rule: previously accepted recommendations of the same shape → boost confidence
  async ({ organizationId, store, rec }) => {
    const recent = await store.query({
      organizationId,
      kinds: ["recommendation.accepted"],
      limit: 50,
      sinceISO: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    });
    const accepts = recent.filter((r) => similarRecommendation(r, rec));
    if (accepts.length === 0) return null;
    return {
      recommendationId: rec.id,
      reason: "previously_accepted",
      confidenceDelta: Math.min(0.08, accepts.length * 0.015),
      explanation: `${accepts.length} similar recommendation${accepts.length === 1 ? " was" : "s were"} accepted in the last 90 days.`,
      evidenceMemoryIds: accepts.map((r) => r.id),
    };
  },

  // Rule: previously rejected similar recommendations → deprioritize + lower confidence
  async ({ organizationId, store, rec }) => {
    const recent = await store.query({
      organizationId,
      kinds: ["recommendation.rejected"],
      limit: 50,
      sinceISO: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    });
    const rejects = recent.filter((r) => similarRecommendation(r, rec));
    if (rejects.length === 0) return null;
    return {
      recommendationId: rec.id,
      reason: "previously_rejected",
      confidenceDelta: -Math.min(0.15, rejects.length * 0.05),
      deprioritize: rejects.length >= 2,
      explanation: `Similar recommendations were rejected ${rejects.length} time${rejects.length === 1 ? "" : "s"} recently. Deprioritized; consider explaining differently.`,
      evidenceMemoryIds: rejects.map((r) => r.id),
    };
  },

  // Rule: previous execution succeeded for this resource → boost
  async ({ organizationId, store, rec }) => {
    const resId = ctxResource(rec);
    if (!resId) return null;
    const recent = await store.query({
      organizationId,
      kinds: ["execution.applied"],
      resourceIds: [resId],
      sinceISO: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    });
    const successes = recent.filter((r) => r.outcome === "positive");
    if (successes.length === 0) return null;
    return {
      recommendationId: rec.id,
      reason: "previous_execution_succeeded",
      confidenceDelta: Math.min(0.07, successes.length * 0.02),
      explanation: `${successes.length} prior execution${successes.length === 1 ? "" : "s"} on this resource succeeded with verification.`,
      evidenceMemoryIds: successes.map((r) => r.id),
    };
  },

  // Rule: previous execution failed or rolled back → force approval, lower confidence
  async ({ organizationId, store, rec }) => {
    const resId = ctxResource(rec);
    if (!resId) return null;
    const failures = await store.query({
      organizationId,
      kinds: ["execution.failed", "rollback.executed", "rollback.failed"],
      resourceIds: [resId],
      sinceISO: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    });
    if (failures.length === 0) return null;
    return {
      recommendationId: rec.id,
      reason: "previous_execution_failed",
      confidenceDelta: -Math.min(0.2, failures.length * 0.08),
      forceApproval: true,
      explanation: `Prior execution on this resource failed or required rollback ${failures.length} time${failures.length === 1 ? "" : "s"}. Approval required regardless of risk tier.`,
      evidenceMemoryIds: failures.map((r) => r.id),
    };
  },

  // Rule: verification failed recently for this resource kind → caution
  async ({ organizationId, store, rec }) => {
    const recent = await store.query({
      organizationId,
      kinds: ["verification.failed"],
      sinceISO: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    });
    if (recent.length < 2) return null;
    return {
      recommendationId: rec.id,
      reason: "verification_failed_recent",
      confidenceDelta: -0.05,
      explanation: `${recent.length} verification failures recorded in the last 30 days. Apply with extra caution.`,
      evidenceMemoryIds: recent.map((r) => r.id),
    };
  },

  // Rule: team consistently prefers export → suggest export path
  async ({ organizationId, store, rec }) => {
    const recent = await store.query({
      organizationId,
      kinds: ["user.decision"],
      sinceISO: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    });
    const exports = recent.filter((r) => r.summary.toLowerCase().includes("export"));
    if (exports.length < 3) return null;
    return {
      recommendationId: rec.id,
      reason: "team_prefers_export",
      confidenceDelta: 0,
      explanation: `Team accepted ${exports.length} Terraform exports recently. This plan can be exported instead of applied through Axiom.`,
      evidenceMemoryIds: exports.map((r) => r.id),
    };
  },
];

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export async function reasonWithMemory(
  snapshot: CloudSnapshot,
  store: MemoryStore,
  organizationId: string
): Promise<MemoryAwareOutput> {
  const base = reasonAboutSnapshot(snapshot);
  const adjustments: Record<string, MemoryAdjustment[]> = {};

  const adjusted: ReasonedRecommendation[] = [];

  for (const rec of base.recommendations) {
    const recAdjustments: MemoryAdjustment[] = [];
    for (const rule of rules) {
      const adj = await rule({ organizationId, store, rec });
      if (adj) recAdjustments.push(adj);
    }
    if (recAdjustments.length === 0) {
      adjusted.push(rec);
      continue;
    }

    // Apply adjustments
    const confDelta = recAdjustments.reduce((s, a) => s + a.confidenceDelta, 0);
    const forceApproval = recAdjustments.some((a) => a.forceApproval);
    const newRec: ReasonedRecommendation = {
      ...rec,
      confidence: Math.max(0, Math.min(1, rec.confidence + confDelta)),
      approvalRequired: rec.approvalRequired || forceApproval,
    };
    adjusted.push(newRec);
    adjustments[rec.id] = recAdjustments;
  }

  // Re-sort by adjusted confidence × cost impact heuristic
  adjusted.sort((a, b) => {
    const aScore = a.confidence * 100 + (a.monthlySavingsUsd ?? 0) * 0.01;
    const bScore = b.confidence * 100 + (b.monthlySavingsUsd ?? 0) * 0.01;
    return bScore - aScore;
  });

  return { ...base, recommendations: adjusted, adjustments };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctxResource(rec: ReasonedRecommendation): string | undefined {
  // Recommendation IDs are formed as rec_finding_<resourceId>_..., so we extract.
  const m = rec.findingId.match(/finding_([^_]+)_/);
  return m?.[1];
}

function similarRecommendation(record: MemoryRecord, rec: ReasonedRecommendation): boolean {
  const recRoot = rec.action.split(" ")[0]?.toLowerCase() ?? "";
  return record.summary.toLowerCase().includes(recRoot);
}
