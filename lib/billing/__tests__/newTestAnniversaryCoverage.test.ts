import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { paidFixture } from "./fixtures/newTestPaidFixture";
import { retrieveCollectedCoverage } from "../newTestSubscription/stripePaidCoverage";
import { ANNIVERSARY_POLICY_V2 } from "../newTestSubscription/anniversaryWindow";
function fixture(annual = false) {
  const f = paidFixture(annual ? { interval: "annual", unitAmountCents: 27840 } : {});
  const start = Date.UTC(2026, 9, 18, 14, 15, 16) / 1000, end = Date.UTC(annual ? 2027 : 2026, annual ? 9 : 10, 18, 14, 15, 16) / 1000;
  Object.assign(f.line.period, { start, end }); Object.assign(f.subscription.items.data[0], { current_period_start: start, current_period_end: end });
  Object.assign(f.invoice.status_transitions, { finalized_at: start, paid_at: start }); f.payment.status_transitions.paid_at = start;
  Object.assign(f.subscription, { billing_cycle_anchor: start, start_date: start, billing_cycle_anchor_config: null, trial_start: null, trial_end: null });
  const policy = { policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: "a".repeat(64), originalAnchor: new Date(start * 1000).toISOString(), originalCreateProofDigest: "e".repeat(64) };
  return { ...f, policy, run: () => retrieveCollectedCoverage(f.client as unknown as Stripe, f.identity, f.subscription as unknown as Stripe.Subscription, async op => op(10000), policy) };
}
describe("V2 collected invoice evidence remains separate from V1 calendar proof", () => {
  it.each([false, true])("accepts an exact full ordinary service interval (annual=%s) only with bound V2 provenance", async annual => {
    const f = fixture(annual), result = await f.run();
    expect(result.collection).toMatchObject({ kind: "collected", evidence: { version: 2, policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: f.policy.enrollmentDigest, originalAnchor: f.policy.originalAnchor, originalCreateProofDigest: f.policy.originalCreateProofDigest, amountCents: annual ? 83520 : 8700, serviceStart: f.policy.originalAnchor } });
    const v1 = await retrieveCollectedCoverage(f.client as unknown as Stripe, f.identity, f.subscription as unknown as Stripe.Subscription, async op => op(10000));
    expect(v1.collection).toEqual({ kind: "unavailable", reason: "unsupported_collection" });
  });
  it("rejects current anchor drift and a partial line without inventing replacement proof", async () => {
    const f = fixture(); Object.assign(f.subscription, { billing_cycle_anchor: f.line.period.start + 1 });
    expect((await f.run()).collection.kind).toBe("unavailable");
    Object.assign(f.subscription, { billing_cycle_anchor: f.line.period.start }); f.line.period.end -= 1; f.subscription.items.data[0].current_period_end -= 1;
    expect((await f.run()).collection.kind).toBe("unavailable");
  });
  it("requires actual full collection after calendar acceptance is widened", async () => {
    const f = fixture(); f.charge.refunded = true;
    expect((await f.run()).collection).toEqual({ kind: "unavailable", reason: "refunded_or_disputed" });
    f.charge.refunded = false; f.invoice.amount_paid--;
    expect((await f.run()).collection).toEqual({ kind: "unavailable", reason: "unsupported_collection" });
  });
});
