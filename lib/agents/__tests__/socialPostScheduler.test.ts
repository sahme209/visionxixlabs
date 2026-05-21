import { describe, it, expect } from "vitest";
import {
  schedulePosts,
  DEFAULT_POLICY,
  type ScheduleRequestItem,
} from "../socialPostScheduler";
import type { SocialDraft } from "../marketingContentDrafter";

function draft(partial: Partial<SocialDraft> & { id: string; channel: SocialDraft["channel"]; body: string }): SocialDraft {
  return {
    id: partial.id,
    channel: partial.channel,
    body: partial.body,
    hashtags: partial.hashtags ?? [],
    cta: partial.cta ?? { label: "x", href: "https://visionxixlabs.com" },
    riskTier: partial.riskTier ?? "low",
    recommendedGate: partial.recommendedGate ?? "single_approval",
    charCount: partial.body.length,
    riskReasons: partial.riskReasons ?? ["test"],
  };
}

function approved(d: SocialDraft, desired: Date): ScheduleRequestItem {
  return { draft: d, approval: { state: "approved", approvedAt: new Date() }, desiredPublishAt: desired };
}

describe("socialPostScheduler", () => {
  // Pin time to noon UTC so blackout (00–06 UTC) tests are deterministic.
  const now = new Date("2026-05-21T12:00:00.000Z");

  it("approved post outside blackout + under cap → ready", () => {
    const d = draft({ id: "draft-1", channel: "linkedin", body: "hello" });
    const { plan, summary } = schedulePosts([approved(d, now)], [], DEFAULT_POLICY, now);
    expect(plan[0].verdict).toBe("ready");
    expect(summary.ready).toBe(1);
  });

  it("pending approval → needs_approval", () => {
    const d = draft({ id: "draft-2", channel: "linkedin", body: "hello" });
    const item: ScheduleRequestItem = { draft: d, approval: { state: "pending" }, desiredPublishAt: now };
    const { plan, summary } = schedulePosts([item], [], DEFAULT_POLICY, now);
    expect(plan[0].verdict).toBe("needs_approval");
    expect(summary.needs_approval).toBe(1);
  });

  it("rejected → blocked", () => {
    const d = draft({ id: "draft-3", channel: "linkedin", body: "hello" });
    const item: ScheduleRequestItem = { draft: d, approval: { state: "rejected" }, desiredPublishAt: now };
    const { plan } = schedulePosts([item], [], DEFAULT_POLICY, now);
    expect(plan[0].verdict).toBe("blocked");
  });

  it("critical + dual_approval → blocked (refuses single-track schedule)", () => {
    const d = draft({
      id: "draft-4",
      channel: "linkedin",
      body: "incident note",
      riskTier: "critical",
      recommendedGate: "dual_approval",
    });
    const { plan } = schedulePosts([approved(d, now)], [], DEFAULT_POLICY, now);
    expect(plan[0].verdict).toBe("blocked");
    expect(plan[0].rationale).toMatch(/dual approval/i);
  });

  it("daily cap → rate_limited", () => {
    const already = [
      { channel: "linkedin" as const, body: "prev1", publishedAt: new Date(now.getTime() - 60 * 60 * 1000) },
      { channel: "linkedin" as const, body: "prev2", publishedAt: new Date(now.getTime() - 120 * 60 * 1000) },
    ];
    const d = draft({ id: "draft-5", channel: "linkedin", body: "third" });
    const { plan } = schedulePosts([approved(d, now)], already, DEFAULT_POLICY, now);
    expect(plan[0].verdict).toBe("rate_limited");
  });

  it("duplicate body within dedup window → duplicate", () => {
    const already = [
      { channel: "linkedin" as const, body: "same body", publishedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    ];
    const d = draft({ id: "draft-6", channel: "linkedin", body: "same body" });
    const { plan } = schedulePosts([approved(d, now)], already, DEFAULT_POLICY, now);
    expect(plan[0].verdict).toBe("duplicate");
  });

  it("blackout-window time → pushed to non-blackout slot", () => {
    const inBlackout = new Date("2026-05-21T03:00:00.000Z"); // 03:00 UTC inside [0,6) blackout
    const d = draft({ id: "draft-7", channel: "linkedin", body: "hello" });
    const { plan } = schedulePosts([approved(d, inBlackout)], [], DEFAULT_POLICY, inBlackout);
    expect(plan[0].verdict).toBe("ready");
    expect(plan[0].publishAt.getUTCHours()).toBeGreaterThanOrEqual(6);
  });

  it("min-gap pushes second linkedin post later", () => {
    const d1 = draft({ id: "draft-8a", channel: "linkedin", body: "first" });
    const d2 = draft({ id: "draft-8b", channel: "linkedin", body: "second" });
    const { plan } = schedulePosts([approved(d1, now), approved(d2, now)], [], DEFAULT_POLICY, now);
    // After d1 schedules at ~now, d2 should be pushed by minGapMinutes.linkedin (240).
    const scheduled = plan.filter((p) => p.verdict === "ready");
    expect(scheduled.length).toBe(2);
    const [first, second] = scheduled;
    const gapMin = (second.publishAt.getTime() - first.publishAt.getTime()) / 60_000;
    expect(gapMin).toBeGreaterThanOrEqual(DEFAULT_POLICY.minGapMinutes.linkedin);
  });

  it("plan is sorted by publishAt ascending", () => {
    const d1 = draft({ id: "draft-9a", channel: "linkedin", body: "a" });
    const d2 = draft({ id: "draft-9b", channel: "x",        body: "b" });
    const { plan } = schedulePosts(
      [approved(d2, new Date(now.getTime() + 60 * 60 * 1000)), approved(d1, now)],
      [],
      DEFAULT_POLICY,
      now,
    );
    expect(plan[0].publishAt.getTime()).toBeLessThanOrEqual(plan[1].publishAt.getTime());
  });

  it("x has higher cap than linkedin", () => {
    const drafts = Array.from({ length: 3 }, (_, i) =>
      draft({ id: `draft-10-${i}`, channel: "x", body: `tweet ${i}` }),
    );
    const items = drafts.map((d, i) => approved(d, new Date(now.getTime() + i * 60_000)));
    const { plan, summary } = schedulePosts(items, [], DEFAULT_POLICY, now);
    // x cap is 4/day; 3 should all schedule.
    expect(summary.ready).toBe(3);
    expect(plan.every((p) => p.channel === "x")).toBe(true);
  });
});
