import { describe, expect, it } from "vitest";
import { allocatePublicCredits, makePublicCreditAttribution, type PublicCreditHold, type PublicCreditPurchase } from "../publicCreditAllocation";
import { publicFreeAllowanceCandidate } from "../publicSubscriptionAllowance";
import type { PublicEnrollment } from "../publicBillingStore";
const now = new Date("2026-10-22T12:00:00.000Z");
const enrollment: PublicEnrollment = { organizationId: "org", id: "enroll", accountId: "acct_test", livemode: false, policy: "axiom_public_anniversary_v1", legacyFreeMonth: "2026-10", legacyFreeUsedCents: 50 };
function window() {
  const c = publicFreeAllowanceCandidate({ policy: enrollment.policy, enrollmentId: enrollment.id, organizationId: enrollment.organizationId }, now);
  if (c.kind !== "public_allowance_candidate") throw Error("fixture"); return c;
}
function hold(value: number, extra: Partial<PublicCreditHold> = {}): PublicCreditHold {
  const a = extra.attribution ?? makePublicCreditAttribution("hold", window(), [{ source: "included", bucketId: window().bucketId, maxCents: value }], now);
  return { id: "hold", organizationId: "org", reservedCents: value, settledCents: null, status: "reserved", createdAt: now, expiresAt: new Date(now.getTime()+300000), usageEventId: null, attribution: a, linkedUsageId: null, usageOrg: null, usageBilledCents: null, usageBillingStatus: null, ...extra };
}
const purchase = (): PublicCreditPurchase => ({ id: "topup", organizationId: "org", deliveredAICreditsCents: 1000, reversedAICreditsCents: 0, status: "paid", validFor: "permanent", periodMonth: "2026-10", refundedAt: null, createdAt: now });

describe("public credit allocation", () => {
  it("preserves Free usage from before enrollment and reserves only the remainder", () => {
    const r = allocatePublicCredits(enrollment,window(),[],[],now,150);
    expect(r).toMatchObject({ baseCents:200,usedCents:50,heldCents:0,remainingCents:150 });
    expect(r.parts).toEqual([{source:"included",bucketId:window().bucketId,maxCents:150}]);
    expect(() => allocatePublicCredits(enrollment,window(),[],[],now,151)).toThrow("ai_credit_pool_exhausted");
  });
  it("retains uncertain holds after TTL", () => {
    const h = hold(100,{status:"dispatch_unknown",expiresAt:new Date(now.getTime()-1000)});
    expect(allocatePublicCredits(enrollment,window(),[h],[],now)).toMatchObject({ heldCents:100,remainingCents:50 });
  });
  it("expires only undispatched, unlinked reservations", () => {
    expect(allocatePublicCredits(enrollment,window(),[hold(100,{expiresAt:new Date(now.getTime()-1)})],[],now).remainingCents).toBe(150);
  });
  it("charges a settlement once and does not count its hold again", () => {
    const h = hold(100,{status:"settled",settledCents:40,usageEventId:"usage",linkedUsageId:"usage",usageOrg:"org",usageBilledCents:40,usageBillingStatus:"settled"});
    expect(allocatePublicCredits(enrollment,window(),[h],[],now)).toMatchObject({usedCents:90,heldCents:0,remainingCents:110});
  });
  it("uses included credit before purchased credit without regranting either", () => {
    const first=allocatePublicCredits(enrollment,window(),[],[purchase()],now,250);
    expect(first.parts).toEqual([{source:"included",bucketId:window().bucketId,maxCents:150},{source:"purchase",purchaseId:"topup",maxCents:100}]);
    const h=hold(250,{attribution:makePublicCreditAttribution("hold",window(),first.parts,now),status:"settled",settledCents:200,usageEventId:"u",linkedUsageId:"u",usageOrg:"org",usageBilledCents:200,usageBillingStatus:"settled"});
    expect(allocatePublicCredits(enrollment,window(),[h],[purchase()],now)).toMatchObject({remainingCents:950,usedCents:250});
  });
  it("never moves the original Free charge into a paid bucket", () => {
    const free=hold(100,{status:"settled",settledCents:100,usageEventId:"u",linkedUsageId:"u",usageOrg:"org",usageBilledCents:100,usageBillingStatus:"settled"});
    const paid={...window(),planId:"pro" as const,includedCents:2000,seats:2,monthlyDeployments:100,bucketId:"b".repeat(64)};
    expect(allocatePublicCredits(enrollment,paid,[free],[],now)).toMatchObject({baseCents:2000,remainingCents:2000,usedCents:0});
  });
  it("refunds reduce purchased availability without rewriting previous attribution", () => {
    const p=purchase();p.reversedAICreditsCents=400;p.status="partially_refunded";
    const r=allocatePublicCredits(enrollment,window(),[],[p],now);
    expect(r.remainingCents).toBe(750);
  });
  it.each([
    (h:PublicCreditHold)=>{h.reservedCents=99;},
    (h:PublicCreditHold)=>{h.organizationId="foreign";},
    (h:PublicCreditHold)=>{h.attribution!.parts[0].maxCents=99;},
    (h:PublicCreditHold)=>{h.status="settled";h.settledCents=100;},
    (h:PublicCreditHold)=>{h.status="pending_settlement";},
  ])("rejects mismatched ledger evidence (%#)",mutate=>{const h=hold(100);mutate(h);expect(()=>allocatePublicCredits(enrollment,window(),[h],[],now)).toThrow();});
  it("canonicalizes JSONB key ordering without changing the attribution identity",()=>{
    const h=hold(100);h.attribution=Object.fromEntries(Object.entries(h.attribution!).reverse()) as typeof h.attribution;
    expect(allocatePublicCredits(enrollment,window(),[h],[],now).remainingCents).toBe(50);
  });
});
