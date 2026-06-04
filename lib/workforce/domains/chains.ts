/**
 * Engineer-to-engineer chains — Phase 612.
 *
 * Declares which engineers fire downstream when an upstream engineer
 * completes. The cron sweep already enforces ordering via
 * sweepPriority — chains.ts handles the manual-click path so a
 * single "Run meta_reasoner" click cascades into council the same
 * way it would inside a cron tick.
 *
 * Only declare a chain when the downstream engineer has a real
 * data dependency on the upstream engineer's persisted output.
 * Cascading too eagerly burns AI budget.
 *
 * Server-only.
 */

import "server-only";

import { findDomainRunner } from "@/lib/workforce/domains/runners";

/** parentEngineerId → engineers to fire downstream after parent persists. */
export const DOWNSTREAM_CHAIN: Readonly<Record<string, ReadonlyArray<string>>> = {
  // Council reads meta_reasoner's persisted observations and casts
  // verdicts against them. Without this cascade the operator would
  // have to click meta_reasoner → wait → click council.
  meta_reasoner_engineer: ["council_engineer"],
};

export interface DownstreamRunSummary {
  engineerId: string;
  outcome: "ai_generated" | "fallback_rules" | "error" | "skipped_no_runner";
  errorMessage: string | null;
}

/**
 * Fires every downstream engineer registered for parentEngineerId.
 * Best-effort: a downstream failure logs and continues so the
 * parent's success outcome isn't masked.
 */
export async function triggerDownstreamChain(
  parentEngineerId: string,
  organizationId: string,
): Promise<DownstreamRunSummary[]> {
  const downstream = DOWNSTREAM_CHAIN[parentEngineerId] ?? [];
  if (downstream.length === 0) return [];
  const results: DownstreamRunSummary[] = [];
  for (const childId of downstream) {
    const runner = findDomainRunner(childId);
    if (!runner) {
      results.push({ engineerId: childId, outcome: "skipped_no_runner", errorMessage: null });
      continue;
    }
    try {
      const r = await runner.runAndPersist(organizationId);
      results.push({ engineerId: childId, outcome: r.outcome, errorMessage: r.errorMessage });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.warn(
        "[downstream-chain]",
        parentEngineerId,
        "→",
        childId,
        "failed:",
        msg,
      );
      results.push({ engineerId: childId, outcome: "error", errorMessage: msg });
    }
  }
  return results;
}
