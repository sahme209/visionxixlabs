/**
 * Pure cost-aware model picker — Phase 403.
 *
 * Given the default model the router would pick + the anticipated
 * cost of the next call + the remaining run-budget cents, decide
 * whether to downgrade to a cheaper tier so the call still fits.
 *
 * Closed-union DowngradeDecisionKind so the audit + the
 * codeProposeRealExecutor can render the precise rationale a model
 * was downgraded (or kept).
 *
 * This kernel is the SOFT half of the cost-control wall:
 *   - assertRunCostBudget (Phase 400) is the HARD halt — refuses
 *     to start the next stage when cumulative spend has already
 *     crossed the cap.
 *   - pickCostAwareModel (Phase 403) is the SOFT optimization —
 *     swaps to a cheaper model BEFORE the anticipated call would
 *     push spend over the cap.
 *
 * Together they guarantee: every pipeline run either completes
 * end-to-end inside its budget, OR halts at a precise stage with
 * a precise reason — never silently blows past.
 *
 * Pure — no I/O.
 */

/** Anthropic model IDs the platform knows the cost shape of. */
export type KnownModel =
  | "claude-opus-4-7"
  | "claude-opus-4-6"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

/**
 * Per-1M-token cost in cents (USD). Sourced from
 * lib/billing/providerRateSeeds.ts — kept inline so this kernel is
 * deterministic + has no I/O dependency.
 *
 * Important: these are FLOATs for math precision; cost-cents in the
 * codebase is integer downstream — Math.ceil at the boundary.
 */
const COST_PER_M_INPUT_TOKENS_CENTS: Record<KnownModel, number> = {
  "claude-opus-4-7":   500, // $5.00
  "claude-opus-4-6":   500,
  "claude-sonnet-4-6": 300, // $3.00
  "claude-haiku-4-5":  100, // $1.00
};

const COST_PER_M_OUTPUT_TOKENS_CENTS: Record<KnownModel, number> = {
  "claude-opus-4-7":   2500, // $25.00
  "claude-opus-4-6":   2500,
  "claude-sonnet-4-6": 1500, // $15.00
  "claude-haiku-4-5":  500,  // $5.00
};

/**
 * Downgrade ladder: each model lists strictly-cheaper alternatives
 * in descending capability order (so we prefer the highest capability
 * that still fits the budget).
 */
const DOWNGRADE_LADDER: Record<KnownModel, ReadonlyArray<KnownModel>> = {
  "claude-opus-4-7":   ["claude-sonnet-4-6", "claude-haiku-4-5"],
  "claude-opus-4-6":   ["claude-sonnet-4-6", "claude-haiku-4-5"],
  "claude-sonnet-4-6": ["claude-haiku-4-5"],
  "claude-haiku-4-5":  [], // already cheapest
};

export type DowngradeDecisionKind =
  | "use_default"               // plenty of budget, no change
  | "use_default_near_limit"    // fits but tight (will trip warn after this call)
  | "downgrade_to_cheaper"      // default would overrun; cheaper alternative fits
  | "no_safe_model"             // even the cheapest tier exceeds remaining budget
  | "unknown_model_passthrough"; // defaultModel isn't in our cost table; can't reason

export interface ModelDecision {
  kind: DowngradeDecisionKind;
  /** The model the caller should use for the next Anthropic call. */
  model: string;
  /** Estimated cost (cents) of the next call at the chosen model. */
  estimatedCostCents: number;
  /** When kind="downgrade_to_cheaper" — how many cents we just saved. */
  savedCents?: number;
  /** Rationale for the audit row + admin debug view. */
  rationale: string;
}

export interface PickModelInput {
  /** What the router would default to (from routeAITask). */
  defaultModel: string;
  /** Cents spent so far on this run (cumulative across prior stages). */
  spentCents: number;
  /** Hard cap in cents. null = unlimited (Enterprise) — always use default. */
  capCents: number | null;
  /** Best-effort estimate of the next call's cost in cents at the default model. */
  anticipatedCostCentsAtDefault: number;
  /**
   * Ratio above which we consider the run "near limit" and may
   * proactively downgrade even if the default still fits. Default 0.7.
   */
  proactiveDowngradeAtRatio?: number;
}

const DEFAULT_PROACTIVE_RATIO = 0.7;

function isKnownModel(m: string): m is KnownModel {
  return (
    m === "claude-opus-4-7" ||
    m === "claude-opus-4-6" ||
    m === "claude-sonnet-4-6" ||
    m === "claude-haiku-4-5"
  );
}

/**
 * Scale the anticipated cost from the default model to a different tier
 * via the published input+output rates. Assumes the input/output ratio
 * is preserved across tiers — the actual call may differ slightly, but
 * the relative cost between Anthropic tiers is consistent (Sonnet ≈ 0.6x
 * Opus, Haiku ≈ 0.2x Opus).
 */
function scaleAnticipatedCost(
  defaultModel: KnownModel,
  targetModel: KnownModel,
  anticipatedAtDefault: number,
): number {
  // Use blended (input + output) cost per 1M tokens as the scale factor.
  // This is approximate but adequate for a pre-call routing decision.
  const defaultBlended =
    COST_PER_M_INPUT_TOKENS_CENTS[defaultModel] +
    COST_PER_M_OUTPUT_TOKENS_CENTS[defaultModel];
  const targetBlended =
    COST_PER_M_INPUT_TOKENS_CENTS[targetModel] +
    COST_PER_M_OUTPUT_TOKENS_CENTS[targetModel];
  if (defaultBlended <= 0) return anticipatedAtDefault;
  const ratio = targetBlended / defaultBlended;
  return Math.max(1, Math.ceil(anticipatedAtDefault * ratio));
}

export function pickCostAwareModel(input: PickModelInput): ModelDecision {
  const proactiveAt = input.proactiveDowngradeAtRatio ?? DEFAULT_PROACTIVE_RATIO;

  // Unlimited tier → always use default.
  if (input.capCents === null) {
    return {
      kind: "use_default",
      model: input.defaultModel,
      estimatedCostCents: input.anticipatedCostCentsAtDefault,
      rationale: "Unlimited budget tier; no cost-aware routing applied.",
    };
  }

  // Unknown model → can't reason about cost; pass through with a flag
  // so the audit captures the gap (rather than silently using a model
  // we have no rate data for).
  if (!isKnownModel(input.defaultModel)) {
    return {
      kind: "unknown_model_passthrough",
      model: input.defaultModel,
      estimatedCostCents: input.anticipatedCostCentsAtDefault,
      rationale: `Model "${input.defaultModel}" not in cost table; passing through without downgrade check.`,
    };
  }

  const remaining = Math.max(0, input.capCents - input.spentCents);
  const anticipated = Math.max(0, Math.ceil(input.anticipatedCostCentsAtDefault));
  const projectedRatioAfter = (input.spentCents + anticipated) / input.capCents;

  // Case 1 — default model fits comfortably (projected ratio still below
  // the proactive threshold). Use default.
  if (anticipated <= remaining && projectedRatioAfter < proactiveAt) {
    return {
      kind: "use_default",
      model: input.defaultModel,
      estimatedCostCents: anticipated,
      rationale: `Default model ${input.defaultModel} fits; projected spend ratio ${(projectedRatioAfter * 100).toFixed(1)}% < ${(proactiveAt * 100).toFixed(0)}%.`,
    };
  }

  // Case 2 — default still fits but tight. Try to find a cheaper tier
  // that returns the projected ratio below the proactive threshold.
  // If found, downgrade proactively; otherwise use default with the
  // "near_limit" flag so the audit records the tight call.
  if (anticipated <= remaining) {
    const downgrades = DOWNGRADE_LADDER[input.defaultModel];
    for (const target of downgrades) {
      const costAtTarget = scaleAnticipatedCost(input.defaultModel, target, anticipated);
      const ratioAfter = (input.spentCents + costAtTarget) / input.capCents;
      if (costAtTarget <= remaining && ratioAfter < proactiveAt) {
        return {
          kind: "downgrade_to_cheaper",
          model: target,
          estimatedCostCents: costAtTarget,
          savedCents: anticipated - costAtTarget,
          rationale: `Proactive downgrade: ${input.defaultModel} → ${target} keeps ratio under ${(proactiveAt * 100).toFixed(0)}% (would be ${(projectedRatioAfter * 100).toFixed(1)}%).`,
        };
      }
    }
    // No safer downgrade — proceed with default but flag it.
    return {
      kind: "use_default_near_limit",
      model: input.defaultModel,
      estimatedCostCents: anticipated,
      rationale: `Default model ${input.defaultModel} fits but projected ratio ${(projectedRatioAfter * 100).toFixed(1)}% ≥ ${(proactiveAt * 100).toFixed(0)}%; no cheaper tier improves headroom enough.`,
    };
  }

  // Case 3 — default OVERRUNS the cap. Find the highest-capability
  // downgrade tier that fits.
  const downgrades = DOWNGRADE_LADDER[input.defaultModel];
  for (const target of downgrades) {
    const costAtTarget = scaleAnticipatedCost(input.defaultModel, target, anticipated);
    if (costAtTarget <= remaining) {
      return {
        kind: "downgrade_to_cheaper",
        model: target,
        estimatedCostCents: costAtTarget,
        savedCents: anticipated - costAtTarget,
        rationale: `Default would overrun (${anticipated}¢ > remaining ${remaining}¢); downgrading ${input.defaultModel} → ${target} (${costAtTarget}¢).`,
      };
    }
  }

  // Case 4 — even the cheapest tier doesn't fit. Caller (the budget gate)
  // should halt. We return the default model + the no_safe_model flag
  // so the executor can short-circuit.
  return {
    kind: "no_safe_model",
    model: input.defaultModel,
    estimatedCostCents: anticipated,
    rationale: `Even the cheapest tier exceeds remaining ${remaining}¢ at anticipated ${anticipated}¢.`,
  };
}
