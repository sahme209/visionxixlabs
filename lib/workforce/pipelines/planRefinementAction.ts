/**
 * Pure refinement planner — Phase 390.
 *
 * After code_propose returns a patch, we validate it locally:
 *   1. Parse the unified diff. Did it parse?
 *   2. Apply it against the sampled base content. Did it apply?
 *
 * This pure reducer takes those signals + the attempt count and
 * returns what to do next:
 *
 *   - "ship"        — diff is shippable; let the downstream stages run
 *   - "retry_parse" — diff didn't parse; ask AI to re-emit with the parser error
 *   - "retry_apply" — diff parsed but applied incorrectly; ask AI to fix
 *   - "give_up"     — exhausted retry budget; ship what we have and audit
 *
 * The retry budget is 1 (we get at most 2 Anthropic calls per stage
 * inside Vercel's 60s serverless ceiling). The "give_up" branch still
 * ships the latest patch so the human reviewer at least sees what the
 * AI tried — a failed refinement is more informative than nothing.
 */

export type RefinementDecisionKind =
  | "ship"
  | "retry_parse"
  | "retry_apply"
  | "give_up";

export interface RefinementInput {
  /** True when parseUnifiedDiff returned ok. */
  parseOk: boolean;
  /** True when we sampled-applied + every sampled file applied cleanly. */
  applyOk: boolean;
  /** 0 on the first proposal; increments each retry. */
  attemptCount: number;
  /** Hard ceiling. Default 1 — we won't burn budget past this. */
  maxAttempts?: number;
}

export interface RefinementDecision {
  kind: RefinementDecisionKind;
  /** Operator-readable reason. */
  reason: string;
}

export function planRefinementAction(input: RefinementInput): RefinementDecision {
  const maxAttempts = input.maxAttempts ?? 1;

  if (input.parseOk && input.applyOk) {
    return { kind: "ship", reason: "Diff parsed and sample-applied cleanly." };
  }

  if (input.attemptCount >= maxAttempts) {
    return {
      kind: "give_up",
      reason: `Exhausted ${maxAttempts} refinement attempt(s); shipping the last proposal so the human reviewer sees the AI's intent.`,
    };
  }

  if (!input.parseOk) {
    return { kind: "retry_parse", reason: "Diff failed to parse as unified diff — asking AI to re-emit." };
  }

  return { kind: "retry_apply", reason: "Diff parsed but applied incorrectly against base — asking AI to refine context lines." };
}
