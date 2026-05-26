/**
 * Autopilot policy + decision kernel.
 *
 * Pure functions only — no I/O. Given a candidate draft + scores + a
 * policy, returns a closed-union decision. The cron route does the I/O.
 *
 * Env-driven policy:
 *   - LINKEDIN_AUTOPILOT_ENABLED          ("true" to enable; default off)
 *   - LINKEDIN_AUTOPILOT_CONFIDENCE_THRESHOLD  (default 0.85)
 *   - LINKEDIN_AUTOPILOT_POST_HOUR_UTC    (default 14 = 9am ET)
 *   - LINKEDIN_AUTOPILOT_POST_DAYS        (comma-separated: 1-5 = Mon-Fri; default "1,2,3,4")
 *
 * The threshold compares MIN(confidence, hallucinationScore). A draft
 * needs BOTH the generator AND the brand check to pass.
 */

import "server-only";

export interface AutopilotPolicy {
  enabled: boolean;
  confidenceThreshold: number;
  /** Hour in UTC (0-23) to schedule the next post. */
  postHourUtc: number;
  /** Days of week (1=Mon … 7=Sun, ISO) when autopilot may schedule. */
  postDays: ReadonlySet<number>;
}

export interface CandidateDraft {
  id: string;
  confidence: number | null;
  hallucinationScore: number | null;
}

export type AutopilotDecision =
  | { kind: "disabled"; reason: "policy_off" | "kill_switch" }
  | { kind: "queued_for_review"; draftId: string; effectiveScore: number; reason: string }
  | { kind: "scheduled"; draftId: string; scheduledFor: Date; effectiveScore: number }
  | { kind: "no_candidate"; reason: "no_drafts_generated" };

// ---------------------------------------------------------------------------
// Policy loader.
// ---------------------------------------------------------------------------

export function loadAutopilotPolicy(): AutopilotPolicy {
  const enabled = (process.env.LINKEDIN_AUTOPILOT_ENABLED ?? "").toLowerCase() === "true";
  const threshold = clampThreshold(parseFloat(process.env.LINKEDIN_AUTOPILOT_CONFIDENCE_THRESHOLD ?? "0.85"));
  const postHourUtc = clampHour(parseInt(process.env.LINKEDIN_AUTOPILOT_POST_HOUR_UTC ?? "14", 10));
  const daysStr = process.env.LINKEDIN_AUTOPILOT_POST_DAYS ?? "1,2,3,4"; // Mon-Thu default — jitter helps avoid spam-classifier
  const postDays = new Set(
    daysStr.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 7),
  );

  return { enabled, confidenceThreshold: threshold, postHourUtc, postDays };
}

function clampThreshold(n: number): number {
  if (!Number.isFinite(n)) return 0.85;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
function clampHour(n: number): number {
  if (!Number.isFinite(n)) return 14;
  if (n < 0) return 0;
  if (n > 23) return 23;
  return n;
}

// ---------------------------------------------------------------------------
// Pure decision kernel — no I/O.
// ---------------------------------------------------------------------------

/**
 * Pick the strongest candidate, then decide what to do with it.
 * `now` is injected so tests can pin the clock.
 */
export function decideAutopilotAction(
  candidates: readonly CandidateDraft[],
  policy: AutopilotPolicy,
  now: Date,
): AutopilotDecision {
  if (candidates.length === 0) {
    return { kind: "no_candidate", reason: "no_drafts_generated" };
  }

  // Compute effective score = MIN(confidence, hallucinationScore). Both must pass.
  const scored = candidates
    .map((c) => ({
      id: c.id,
      effectiveScore: Math.min(c.confidence ?? 0, c.hallucinationScore ?? 0),
    }))
    .sort((a, b) => b.effectiveScore - a.effectiveScore);

  const best = scored[0];

  if (!policy.enabled) {
    return { kind: "disabled", reason: "policy_off" };
  }

  if (best.effectiveScore < policy.confidenceThreshold) {
    return {
      kind: "queued_for_review",
      draftId: best.id,
      effectiveScore: best.effectiveScore,
      reason: `min(confidence, hallucinationScore) = ${best.effectiveScore.toFixed(3)} below threshold ${policy.confidenceThreshold}`,
    };
  }

  const scheduledFor = nextScheduleSlot(now, policy);
  return { kind: "scheduled", draftId: best.id, scheduledFor, effectiveScore: best.effectiveScore };
}

/**
 * Find the next valid schedule slot (UTC hour on a permitted day-of-week).
 * If today's slot is already past, picks the next permitted day.
 */
export function nextScheduleSlot(now: Date, policy: AutopilotPolicy): Date {
  // ISO day-of-week: 1=Mon … 7=Sun. JS getUTCDay returns 0=Sun … 6=Sat.
  const isoDow = (d: Date) => {
    const js = d.getUTCDay();
    return js === 0 ? 7 : js;
  };

  for (let i = 0; i < 14; i++) {
    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + i,
      policy.postHourUtc, 0, 0, 0,
    ));
    if (candidate.getTime() <= now.getTime()) continue;
    if (!policy.postDays.has(isoDow(candidate))) continue;
    return candidate;
  }

  // Fallback — should be unreachable given postDays is non-empty.
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
