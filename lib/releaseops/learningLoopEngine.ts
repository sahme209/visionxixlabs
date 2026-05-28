/**
 * Phase 511 — Learning Loop engine.
 *
 * Pure clustering of operator rejection/override notes across the
 * three AGI engines (Release Advisor, Policy Proposal, Incident
 * Triage). Surfaces "engine-improvement signals" the platform team
 * can act on:
 *
 *   • "8 operators rejected propose_freeze with notes mentioning
 *      'planned maintenance' — consider new input signal."
 *   • "5 incident triages were overridden P2 → P0 with notes
 *      mentioning 'data loss' — tighten priority rule."
 *
 * Pure: takes pre-fetched buckets of (engine, kind, decision, note)
 * tuples, returns ranked improvement signals. No DB, no I/O.
 */

export const LEARNING_LOOP_ENGINE_VERSION = "learning-loop-v1.0.0";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const LEARNING_ENGINES = ["release_advisor", "policy_proposal", "incident_triage"] as const;
export type LearningEngine = (typeof LEARNING_ENGINES)[number];

export const LEARNING_SIGNAL_KINDS = [
  "rejection_cluster",
  "override_cluster",
  "low_confidence_acceptance",
  "high_rejection_rate",
] as const;
export type LearningSignalKind = (typeof LEARNING_SIGNAL_KINDS)[number];

/* ──────────────────────────────────────────────────────────────────
   Inputs.
   ────────────────────────────────────────────────────────────── */

export interface OperatorDecisionRow {
  engine: LearningEngine;
  kind: string;          // engine-specific kind (e.g. "propose_freeze")
  decision: "accepted" | "rejected" | "overridden" | "dismissed" | "implemented";
  note: string | null;
  confidence: number;
  decidedAtIso: string;
}

export interface LearningLoopInputs {
  rows: OperatorDecisionRow[];
  /** Minimum cluster size for a rejection_cluster signal. Default 3. */
  rejectionClusterMin: number;
  /** Minimum cluster size for an override_cluster signal. Default 2. */
  overrideClusterMin: number;
  /** Rejection-rate threshold for high_rejection_rate (e.g. 0.5). */
  highRejectionRateThreshold: number;
  /** Confidence threshold for low_confidence_acceptance (e.g. 60). */
  lowConfidenceCeiling: number;
  now: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface LearningSignal {
  kind: LearningSignalKind;
  engine: LearningEngine;
  /** Engine-specific kind the signal targets (e.g. "propose_freeze"). */
  targetKind: string;
  /** Cluster keyword that surfaced, when applicable. */
  keyword: string | null;
  occurrences: number;
  /** 0-100 — how strong is this signal. */
  strength: number;
  title: string;
  rationale: string;
  /** Suggested next action for the platform team. */
  suggestedAction: string;
}

export interface LearningLoopOutput {
  engineVersion: string;
  generatedAtIso: string;
  signals: LearningSignal[];
  summary: { totalRows: number; signalsByKind: Record<LearningSignalKind, number> };
}

/* ──────────────────────────────────────────────────────────────────
   Pure engine.
   ────────────────────────────────────────────────────────────── */

// Words we never cluster on — too generic to be useful as themes.
const STOP_WORDS = new Set([
  "the", "and", "but", "for", "are", "with", "from", "this", "that",
  "have", "has", "had", "was", "were", "will", "would", "should",
  "could", "their", "there", "these", "those", "into", "more", "less",
  "than", "then", "when", "where", "what", "which", "while", "after",
  "before", "during", "about", "above", "below", "between", "among",
  "is", "it", "to", "of", "in", "on", "by", "as", "an", "or", "we",
  "us", "you", "they", "i", "me", "my", "our", "your", "they're",
  "not", "no", "yes", "very", "just", "only", "even", "still",
  // Domain stopwords
  "release", "deploy", "release", "incident", "policy", "rule",
]);

function tokenize(note: string): string[] {
  return note
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
}

/**
 * Group rows by (engine, targetKind, decision), then within each
 * group cluster by repeated note keywords.
 */
export function generateLearningSignals(input: LearningLoopInputs): LearningLoopOutput {
  const signals: LearningSignal[] = [];

  // Bucket rows by (engine + targetKind).
  type BucketKey = string;
  const buckets = new Map<BucketKey, OperatorDecisionRow[]>();
  for (const r of input.rows) {
    const k = `${r.engine}:${r.kind}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }

  for (const [bucketKey, rows] of buckets.entries()) {
    const [engineRaw, targetKind] = bucketKey.split(":");
    const engine = engineRaw as LearningEngine;

    // ── rejection_cluster — cluster keywords in rejected rows ────
    const rejected = rows.filter((r) => r.decision === "rejected" && r.note);
    if (rejected.length >= input.rejectionClusterMin) {
      const cluster = topKeyword(rejected.map((r) => r.note ?? ""));
      if (cluster && cluster.count >= input.rejectionClusterMin) {
        signals.push({
          kind: "rejection_cluster",
          engine,
          targetKind,
          keyword: cluster.word,
          occurrences: cluster.count,
          strength: Math.min(95, 50 + cluster.count * 10),
          title: `${cluster.count} ${targetKind} rejections mention "${cluster.word}"`,
          rationale: `Operators rejected ${rejected.length} ${targetKind} ${engine} outputs, and ${cluster.count} of those rejection notes mention "${cluster.word}". This is a missing input signal — consider feeding it into the engine.`,
          suggestedAction: `Inspect rejected ${targetKind} rationales. If the operators are consistently citing "${cluster.word}", surface that as a new engine input (or as a precondition that suppresses the recommendation).`,
        });
      }
    }

    // ── override_cluster — same for overrides (used by Incident Triage) ──
    const overridden = rows.filter((r) => r.decision === "overridden" && r.note);
    if (overridden.length >= input.overrideClusterMin) {
      const cluster = topKeyword(overridden.map((r) => r.note ?? ""));
      if (cluster && cluster.count >= input.overrideClusterMin) {
        signals.push({
          kind: "override_cluster",
          engine,
          targetKind,
          keyword: cluster.word,
          occurrences: cluster.count,
          strength: Math.min(95, 55 + cluster.count * 10),
          title: `${cluster.count} ${targetKind} overrides mention "${cluster.word}"`,
          rationale: `Operators overrode ${overridden.length} ${targetKind} outputs, and ${cluster.count} of those notes mention "${cluster.word}". The engine's first-pass call is consistently wrong in this context.`,
          suggestedAction: `Adjust the engine's rule for ${targetKind} so that when "${cluster.word}" appears in the input signals, the projection matches the operator's chosen value.`,
        });
      }
    }

    // ── low_confidence_acceptance — accepted with low confidence ─
    const lowConfAccepted = rows.filter((r) =>
      r.decision === "accepted" && r.confidence < input.lowConfidenceCeiling,
    );
    if (lowConfAccepted.length >= 3) {
      const avgConf = Math.round(lowConfAccepted.reduce((s, r) => s + r.confidence, 0) / lowConfAccepted.length);
      signals.push({
        kind: "low_confidence_acceptance",
        engine,
        targetKind,
        keyword: null,
        occurrences: lowConfAccepted.length,
        strength: Math.min(80, 40 + lowConfAccepted.length * 5),
        title: `${lowConfAccepted.length} ${targetKind} accepted at low confidence (avg ${avgConf}%)`,
        rationale: `The engine is producing ${targetKind} outputs at confidence < ${input.lowConfidenceCeiling}% that operators still accept. The engine's calibration is too conservative — it should be MORE confident when the signal is clear.`,
        suggestedAction: `Re-tune the confidence formula for ${targetKind}. The current floor is leaving signal on the table; the engine should communicate certainty when it's actually certain.`,
      });
    }

    // ── high_rejection_rate — rejection rate > threshold ─────────
    const decided = rows.filter((r) => r.decision !== "implemented" && r.decision !== "dismissed");
    if (decided.length >= 5) {
      const rejectedRatio = decided.filter((r) => r.decision === "rejected").length / decided.length;
      if (rejectedRatio >= input.highRejectionRateThreshold) {
        signals.push({
          kind: "high_rejection_rate",
          engine,
          targetKind,
          keyword: null,
          occurrences: decided.filter((r) => r.decision === "rejected").length,
          strength: Math.min(95, Math.round(rejectedRatio * 100)),
          title: `${Math.round(rejectedRatio * 100)}% of ${targetKind} are rejected`,
          rationale: `${decided.filter((r) => r.decision === "rejected").length}/${decided.length} of decided ${targetKind} outputs were rejected. The engine's rule for this kind is mis-calibrated for this org — review whether the trigger conditions are too aggressive.`,
          suggestedAction: `Either soften the trigger for ${targetKind} (raise threshold, add suppression conditions) or document why the engine is right and operators are over-rejecting.`,
        });
      }
    }
  }

  // Rank by strength desc, then occurrences desc.
  signals.sort((a, b) => (b.strength - a.strength) || (b.occurrences - a.occurrences));

  // Summary by kind.
  const signalsByKind: Record<LearningSignalKind, number> = {
    rejection_cluster: 0,
    override_cluster: 0,
    low_confidence_acceptance: 0,
    high_rejection_rate: 0,
  };
  for (const s of signals) signalsByKind[s.kind] += 1;

  return {
    engineVersion: LEARNING_LOOP_ENGINE_VERSION,
    generatedAtIso: input.now.toISOString(),
    signals,
    summary: { totalRows: input.rows.length, signalsByKind },
  };
}

/* ──────────────────────────────────────────────────────────────────
   Internal helper — top keyword across a batch of notes.
   ────────────────────────────────────────────────────────────── */

function topKeyword(notes: string[]): { word: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const note of notes) {
    const seen = new Set<string>(); // count once per note
    for (const t of tokenize(note)) {
      if (seen.has(t)) continue;
      seen.add(t);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  let bestWord = "";
  let bestCount = 0;
  for (const [word, count] of counts.entries()) {
    if (count > bestCount) { bestWord = word; bestCount = count; }
  }
  if (bestCount === 0) return null;
  return { word: bestWord, count: bestCount };
}
