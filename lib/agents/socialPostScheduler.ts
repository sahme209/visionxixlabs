/**
 * Pure AGI-Engineer social post scheduler.
 *
 * Input: a list of drafted social posts (from marketingContentDrafter)
 * + a schedule policy (caps per day / blackout windows / minimum gap).
 * Output: an ordered posting plan with per-post verdicts.
 *
 * Why this kernel exists: even with operator approval, drafts can pile
 * up. The scheduler enforces caps so the brand never spams, dedup so
 * the same post doesn't go out twice, and blackout windows so an
 * incident post doesn't ship during an unrelated incident.
 *
 * Pure / deterministic. Closed unions on verdict so new shapes break
 * the build.
 */

import type { SocialChannel, SocialDraft, RiskTier } from "./marketingContentDrafter";

export type ScheduleVerdict =
  | "ready"
  | "rate_limited"      // already at the cap for this channel today
  | "blackout"          // within a blackout window
  | "duplicate"         // identical body posted within dedup window
  | "needs_approval"    // not yet approved
  | "blocked";          // hard rule (e.g. dual approval missing on critical)

export interface SchedulePolicy {
  /** Cap on POSTED posts per channel per 24h. */
  perChannelDailyCap: Readonly<Record<SocialChannel, number>>;
  /** Minimum minutes between two posts on the same channel. */
  minGapMinutes: Readonly<Record<SocialChannel, number>>;
  /** Windows during which NO post may be scheduled. [hours UTC, half-open). */
  blackoutWindowsUtc: ReadonlyArray<readonly [number, number]>;
  /** Identical-body dedup window in hours. */
  dedupWindowHours: number;
}

export const DEFAULT_POLICY: SchedulePolicy = {
  perChannelDailyCap: { linkedin: 2, x: 4, blog: 1 },
  minGapMinutes:      { linkedin: 240, x: 60, blog: 1440 },
  blackoutWindowsUtc: [[0, 6]], // 00:00–06:00 UTC quiet hours
  dedupWindowHours:   72,
};

export interface ScheduleRequestItem {
  /** The draft (output of marketingContentDrafter). */
  draft: SocialDraft;
  /** Operator-approved state of this draft. */
  approval: { state: "pending" | "approved" | "rejected"; approvedAt?: Date };
  /** Desired publish time. Scheduler MAY push it later if rate-limited. */
  desiredPublishAt: Date;
}

export interface AlreadyPostedRow {
  channel: SocialChannel;
  body: string;
  publishedAt: Date;
}

export interface ScheduledPost {
  draftId: string;
  channel: SocialChannel;
  riskTier: RiskTier;
  /** Final verdict — only "ready" posts actually publish. */
  verdict: ScheduleVerdict;
  /** Actual publish time after scheduling adjustments. */
  publishAt: Date;
  /** Operator-readable rationale for the verdict. */
  rationale: string;
}

export interface SchedulePlanResult {
  /** Ordered plan, soonest first. */
  plan: readonly ScheduledPost[];
  /** Counts per verdict for the cockpit summary chip. */
  summary: Readonly<Record<ScheduleVerdict, number>>;
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function isInBlackout(d: Date, windows: SchedulePolicy["blackoutWindowsUtc"]): boolean {
  const hourUtc = d.getUTCHours();
  for (const [start, end] of windows) {
    if (hourUtc >= start && hourUtc < end) return true;
  }
  return false;
}

function nextNonBlackout(d: Date, windows: SchedulePolicy["blackoutWindowsUtc"]): Date {
  let out = new Date(d.getTime());
  // Up to 24 hourly bumps — safe upper bound.
  for (let i = 0; i < 24 && isInBlackout(out, windows); i++) {
    out = new Date(out.getTime() + HOUR_MS);
  }
  return out;
}

export function schedulePosts(
  items: readonly ScheduleRequestItem[],
  alreadyPosted: readonly AlreadyPostedRow[],
  policy: SchedulePolicy = DEFAULT_POLICY,
  now: Date = new Date(),
): SchedulePlanResult {
  // Per-channel running counters within the next 24h window.
  const dailyCount: Record<SocialChannel, number> = { linkedin: 0, x: 0, blog: 0 };
  for (const row of alreadyPosted) {
    if (now.getTime() - row.publishedAt.getTime() < 24 * HOUR_MS) {
      dailyCount[row.channel] += 1;
    }
  }

  // Sort items by desiredPublishAt ascending so we honour intent.
  const sorted = [...items].sort(
    (a, b) => a.desiredPublishAt.getTime() - b.desiredPublishAt.getTime(),
  );

  // Track the last scheduled time per channel for the min-gap rule.
  const lastScheduledByChannel: Partial<Record<SocialChannel, Date>> = {};
  for (const row of alreadyPosted) {
    const prev = lastScheduledByChannel[row.channel];
    if (!prev || row.publishedAt.getTime() > prev.getTime()) {
      lastScheduledByChannel[row.channel] = row.publishedAt;
    }
  }

  // Bodies seen recently — for dedup.
  const dedupSince = now.getTime() - policy.dedupWindowHours * HOUR_MS;
  const recentBodies = new Set(
    alreadyPosted
      .filter((p) => p.publishedAt.getTime() >= dedupSince)
      .map((p) => `${p.channel}::${p.body.trim()}`),
  );

  const plan: ScheduledPost[] = [];
  const summary: Record<ScheduleVerdict, number> = {
    ready: 0,
    rate_limited: 0,
    blackout: 0,
    duplicate: 0,
    needs_approval: 0,
    blocked: 0,
  };

  for (const item of sorted) {
    const { draft, approval } = item;
    const dedupKey = `${draft.channel}::${draft.body.trim()}`;

    // ── Hard rules first ────────────────────────────────────────
    if (approval.state === "rejected") {
      plan.push({
        draftId: draft.id,
        channel: draft.channel,
        riskTier: draft.riskTier,
        verdict: "blocked",
        publishAt: item.desiredPublishAt,
        rationale: "Draft was rejected by the operator.",
      });
      summary.blocked += 1;
      continue;
    }
    if (approval.state === "pending") {
      plan.push({
        draftId: draft.id,
        channel: draft.channel,
        riskTier: draft.riskTier,
        verdict: "needs_approval",
        publishAt: item.desiredPublishAt,
        rationale: `Awaiting ${draft.recommendedGate.replace("_", " ")} before publish.`,
      });
      summary.needs_approval += 1;
      continue;
    }
    if (draft.recommendedGate === "dual_approval" && draft.riskTier === "critical") {
      // Treat critical+dual_approval as gated until an explicit second
      // approval is recorded — this kernel only sees a single approval
      // flag, so refuse to schedule critical posts here.
      plan.push({
        draftId: draft.id,
        channel: draft.channel,
        riskTier: draft.riskTier,
        verdict: "blocked",
        publishAt: item.desiredPublishAt,
        rationale: "Critical-tier post requires dual approval — schedule from the dual-approval queue.",
      });
      summary.blocked += 1;
      continue;
    }
    if (recentBodies.has(dedupKey)) {
      plan.push({
        draftId: draft.id,
        channel: draft.channel,
        riskTier: draft.riskTier,
        verdict: "duplicate",
        publishAt: item.desiredPublishAt,
        rationale: `Identical body posted on ${draft.channel} within the last ${policy.dedupWindowHours}h.`,
      });
      summary.duplicate += 1;
      continue;
    }

    // ── Adjust desiredPublishAt to honour blackouts + gaps ──────
    let when = new Date(Math.max(item.desiredPublishAt.getTime(), now.getTime()));
    when = nextNonBlackout(when, policy.blackoutWindowsUtc);

    const last = lastScheduledByChannel[draft.channel];
    if (last) {
      const earliest = new Date(last.getTime() + policy.minGapMinutes[draft.channel] * MINUTE_MS);
      if (earliest.getTime() > when.getTime()) when = earliest;
    }

    // ── Caps ────────────────────────────────────────────────────
    if (dailyCount[draft.channel] >= policy.perChannelDailyCap[draft.channel]) {
      plan.push({
        draftId: draft.id,
        channel: draft.channel,
        riskTier: draft.riskTier,
        verdict: "rate_limited",
        publishAt: when,
        rationale: `Channel ${draft.channel} already at cap (${policy.perChannelDailyCap[draft.channel]}/24h).`,
      });
      summary.rate_limited += 1;
      continue;
    }

    if (isInBlackout(when, policy.blackoutWindowsUtc)) {
      // nextNonBlackout already moved past it; if still blackout the
      // window is somehow > 24h wide. Mark blocked.
      plan.push({
        draftId: draft.id,
        channel: draft.channel,
        riskTier: draft.riskTier,
        verdict: "blackout",
        publishAt: when,
        rationale: "Could not find a non-blackout slot within 24h.",
      });
      summary.blackout += 1;
      continue;
    }

    // ── All clear ───────────────────────────────────────────────
    plan.push({
      draftId: draft.id,
      channel: draft.channel,
      riskTier: draft.riskTier,
      verdict: "ready",
      publishAt: when,
      rationale: `Approved + within ${draft.channel} cap. Publishes at ${when.toISOString()}.`,
    });
    summary.ready += 1;
    dailyCount[draft.channel] += 1;
    lastScheduledByChannel[draft.channel] = when;
    recentBodies.add(dedupKey);
  }

  // Stable order: by publishAt ascending.
  plan.sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime());
  return { plan, summary };
}
