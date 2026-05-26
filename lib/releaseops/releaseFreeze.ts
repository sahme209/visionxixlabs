/**
 * Phase 458 — release-freeze + day-of-PR detection.
 *
 * Pure functions that classify whether a release is past its
 * scope-finalization deadline AND surface PRs that snuck in after
 * the freeze. Feeds into:
 *  - the policy engine (Phase 443) — adds `last_minute_pr_*` violation
 *  - the readiness snapshot — surfaces "scope changed after freeze"
 *
 * No I/O. Caller supplies the release row + the relevant PR list.
 */

import type { PullRequestRecordRow } from "./gitDiscoveryRepo";

/* ──────────────────────────────────────────────────────────────────
   FreezeStatus — closed-union of where the release sits vs its
   freeze deadline.
   ────────────────────────────────────────────────────────────── */

export type FreezeStatus =
  | "not_yet_finalized"       // scope still in draft
  | "frozen"                   // scope finalized, no day-of changes
  | "frozen_with_late_change"  // scope finalized, but a PR landed after
  | "deploy_window_started";   // deploy already in flight

export interface FreezeDecisionInput {
  /** When the operator finalized scope (draft → ready). null = not yet. */
  scopeFinalizedAt: Date | null;
  /** When the actual deploy started. null = not yet. */
  actualDeployStart: Date | null;
  /** PRs that are part of the release. */
  prs: ReadonlyArray<PullRequestRecordRow>;
  /** Override "now" for tests. */
  now?: Date;
}

export interface FreezeDecision {
  status: FreezeStatus;
  /** PRs merged AFTER scopeFinalizedAt (only meaningful when status=frozen_with_late_change). */
  lateMergedPrs: ReadonlyArray<PullRequestRecordRow>;
  /** Hours between scope-finalization and now (or deploy start, if started). */
  hoursSinceScopeFinalized: number | null;
  /** Operator-readable summary line. */
  summary: string;
}

export function decideFreezeStatus(input: FreezeDecisionInput): FreezeDecision {
  const now = input.now ?? new Date();

  if (!input.scopeFinalizedAt) {
    return {
      status: "not_yet_finalized",
      lateMergedPrs: [],
      hoursSinceScopeFinalized: null,
      summary: "Scope not yet finalized — operator may freely add or remove PRs.",
    };
  }

  if (input.actualDeployStart) {
    return {
      status: "deploy_window_started",
      lateMergedPrs: [],
      hoursSinceScopeFinalized: hoursBetween(input.scopeFinalizedAt, input.actualDeployStart),
      summary: `Deploy started at ${input.actualDeployStart.toISOString()}; scope is locked.`,
    };
  }

  // Frozen but not yet deploying — check for late merges.
  const lateMergedPrs = input.prs.filter((p) =>
    p.state === "merged" &&
    p.mergedAt !== null &&
    p.mergedAt > input.scopeFinalizedAt!,
  );

  if (lateMergedPrs.length === 0) {
    return {
      status: "frozen",
      lateMergedPrs: [],
      hoursSinceScopeFinalized: hoursBetween(input.scopeFinalizedAt, now),
      summary: `Frozen at ${input.scopeFinalizedAt.toISOString()}; no PRs merged after freeze.`,
    };
  }

  return {
    status: "frozen_with_late_change",
    lateMergedPrs,
    hoursSinceScopeFinalized: hoursBetween(input.scopeFinalizedAt, now),
    summary: `${lateMergedPrs.length} PR(s) merged after scope was frozen — exception approval required.`,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Day-of-PR detection — a stronger variant of "late merge" that fires
   when the merge timestamp is within the same calendar day as the
   planned deploy window.
   ────────────────────────────────────────────────────────────── */

export interface DayOfPrDetectionInput {
  prs: ReadonlyArray<PullRequestRecordRow>;
  /** The planned deploy window start; the calendar-day cutoff. */
  plannedWindowStart: Date | null;
  /** Timezone offset in minutes (e.g. -300 for EST). Defaults to UTC. */
  timezoneOffsetMinutes?: number;
}

export interface DayOfPrDetection {
  dayOfPrs: ReadonlyArray<PullRequestRecordRow>;
  /** True iff any day-of PR exists — drives the policy violation. */
  hasAny: boolean;
}

export function detectDayOfPrs(input: DayOfPrDetectionInput): DayOfPrDetection {
  if (!input.plannedWindowStart) {
    return { dayOfPrs: [], hasAny: false };
  }
  const windowDayKey = calendarDayKey(input.plannedWindowStart, input.timezoneOffsetMinutes ?? 0);
  const dayOfPrs = input.prs.filter((p) => {
    if (p.state !== "merged" || !p.mergedAt) return false;
    return calendarDayKey(p.mergedAt, input.timezoneOffsetMinutes ?? 0) === windowDayKey;
  });
  return { dayOfPrs, hasAny: dayOfPrs.length > 0 };
}

/* ──────────────────────────────────────────────────────────────────
   Helpers.
   ────────────────────────────────────────────────────────────── */

function hoursBetween(a: Date, b: Date): number {
  return Math.round(((b.getTime() - a.getTime()) / 36e5) * 100) / 100;
}

function calendarDayKey(d: Date, offsetMinutes: number): string {
  const local = new Date(d.getTime() + offsetMinutes * 60_000);
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
