import { describe, expect, it } from "vitest";
import { PUBLIC_PLAN_CATALOG } from "../publicPlanCatalog";
import { publicFreeAllowanceCandidate, publicPaidAllowanceCandidate, type PublicPaidAllowanceBasis, type PublicCollectedCoverage } from "../publicSubscriptionAllowance";

const basis = (): PublicPaidAllowanceBasis => ({ policy: "axiom_public_anniversary_v1", enrollmentId: "enrollment-new-public", organizationId: "org-new-public", accountId: "acct_live_public", contractId: "contract-public", subscriptionId: "sub_public", planId: "pro", interval: "monthly", paidSeats: 3, priceId: "price_public", unitAmountCents: 2900, anchor: "2026-01-31T12:34:56.000Z", originalCreateProofDigest: "a".repeat(64), firstCollectionDigest: "b".repeat(64) });
const coverage = (): PublicCollectedCoverage => ({ kind: "collected", livemode: true, status: "active", enrollmentId: "enrollment-new-public", organizationId: "org-new-public", accountId: "acct_live_public", contractId: "contract-public", subscriptionId: "sub_public", priceId: "price_public", paidSeats: 3, originalCreateProofDigest: "a".repeat(64), invoiceId: "in_public", evidenceDigest: "b".repeat(64), amountCents: 8700, serviceStart: "2026-01-31T12:34:56.000Z", serviceEnd: "2026-02-28T12:34:56.000Z", collectedAt: "2026-01-31T12:34:56.000Z" });
const at = (s = "2026-02-15T00:00:00.000Z") => new Date(s);

describe("production public allowance arithmetic candidates (no storage or payment authority)", () => {
  it("gives new public Free exactly $2, two seats and ten deployments in a nonrolling UTC month", () => {
    const f = { policy: "axiom_public_anniversary_v1" as const, enrollmentId: "new-free", organizationId: "org-free" };
    const x = publicFreeAllowanceCandidate(f, at());
    expect(x).toMatchObject({ kind: "public_allowance_candidate", planId: "free", includedCents: 200, seats: 2, monthlyDeployments: 10, start: "2026-02-01T00:00:00.000Z", end: "2026-03-01T00:00:00.000Z", authoritative: false });
    const next = publicFreeAllowanceCandidate(f, at("2026-03-01T00:00:00.000Z"));
    expect(next).toMatchObject({ includedCents: 200 }); expect(next).not.toEqual(x);
  });
  it("grants the full $30 first paid pool for three Pro seats without a Free balance input", () => {
    expect(publicPaidAllowanceCandidate(basis(), coverage(), at())).toMatchObject({ kind: "public_allowance_candidate", planId: "pro", includedCents: 3000, seats: 3, monthlyDeployments: 100, start: "2026-01-31T12:34:56.000Z", end: "2026-02-28T12:34:56.000Z", authoritative: false });
  });
  it("uses original January31 on March instead of drifting after February", () => {
    const c = { ...coverage(), serviceStart: "2026-02-28T12:34:56.000Z", serviceEnd: "2026-03-31T12:34:56.000Z", collectedAt: "2026-02-28T12:34:56.000Z", evidenceDigest: "c".repeat(64) };
    expect(publicPaidAllowanceCandidate(basis(), c, at("2026-03-20T00:00:00.000Z"))).toMatchObject({ start: c.serviceStart, end: c.serviceEnd, includedCents: 3000 });
  });
  it("uses 20percent discounted annual collection but twelve distinct monthly pools", () => {
    const b = { ...basis(), interval: "annual" as const, unitAmountCents: 27840 };
    const c = { ...coverage(), amountCents: 83520, serviceEnd: "2027-01-31T12:34:56.000Z" };
    const x = publicPaidAllowanceCandidate(b, c, at()), y = publicPaidAllowanceCandidate(b, c, at("2026-03-20T00:00:00.000Z"));
    expect(x).toMatchObject({ includedCents: 3000, end: "2026-02-28T12:34:56.000Z" });
    expect(y).toMatchObject({ includedCents: 3000, start: "2026-02-28T12:34:56.000Z", end: "2026-03-31T12:34:56.000Z" });
    expect(x).not.toEqual(y);
  });
  it("uses $30 per Enterprise seat with the advertised deployment cap", () => {
    const b = { ...basis(), planId: "enterprise" as const, unitAmountCents: 7900 };
    expect(publicPaidAllowanceCandidate(b, { ...coverage(), amountCents: 23700 }, at())).toMatchObject({ includedCents: 9000, monthlyDeployments: 500 });
  });
  it("retains leap-day anniversary and excludes the exact old monthly end", () => {
    const b = { ...basis(), anchor: "2024-02-29T12:34:56.000Z", interval: "annual" as const, unitAmountCents: 27840 };
    const c = { ...coverage(), amountCents: 83520, serviceStart: b.anchor, serviceEnd: "2025-02-28T12:34:56.000Z", collectedAt: b.anchor };
    expect(publicPaidAllowanceCandidate(b, c, at("2024-03-29T12:34:56.000Z"))).toMatchObject({ start: "2024-03-29T12:34:56.000Z", end: "2024-04-29T12:34:56.000Z" });
    expect(publicPaidAllowanceCandidate(b, c, at(c.serviceEnd))).toEqual({ kind: "unavailable" });
  });
  it.each(["past_due", "canceled", "trialing", "no_plan"])("cannot grant paid allowance from status %s", status => {
    expect(publicPaidAllowanceCandidate(basis(), { ...coverage(), status }, at())).toEqual({ kind: "unavailable" });
  });
  it("refuses missing/negative coverage rather than falling back to Free", () => {
    expect(publicPaidAllowanceCandidate(basis(), null, at())).toEqual({ kind: "unavailable" });
    expect(publicPaidAllowanceCandidate(basis(), { kind: "unavailable" }, at())).toEqual({ kind: "unavailable" });
  });
  it.each(["enrollmentId", "organizationId", "accountId", "contractId", "subscriptionId", "priceId", "originalCreateProofDigest"])("rejects foreign collection coordinate %s", key => {
    expect(publicPaidAllowanceCandidate(basis(), { ...coverage(), [key]: "foreign" }, at())).toEqual({ kind: "unavailable" });
  });
  it("rejects wrong first-collection identity and retains a frozen original basis across renewals", () => {
    expect(publicPaidAllowanceCandidate(basis(), { ...coverage(), evidenceDigest: "c".repeat(64) }, at())).toEqual({ kind: "unavailable" });
  });
  it.each([{ livemode: false }, { amountCents: 1 }, { paidSeats: 4 }, { serviceEnd: "2026-03-01T12:34:56.000Z" }, { collectedAt: "2026-02-16T00:00:00.000Z" }, { collectedAt: "2026-01-30T00:00:00.000Z" }])("rejects unsupported collection terms %#", change => {
    expect(publicPaidAllowanceCandidate(basis(), { ...coverage(), ...change }, at())).toEqual({ kind: "unavailable" });
  });
  it.each([{ unitAmountCents: 2901 }, { paidSeats: 0 }, { paidSeats: Number.MAX_SAFE_INTEGER }, { anchor: "invalid" }, { anchor: "2026-01-31T12:34:56.001Z" }, { originalCreateProofDigest: "bad" }])("rejects malformed basis %#", change => {
    expect(publicPaidAllowanceCandidate({ ...basis(), ...change }, coverage(), at())).toEqual({ kind: "unavailable" });
  });
  it.each(["monthlyAiCreditCents", "monthlyDeployments", "monthlyPricePerUserCents", "annualPricePerUserCents"] as const)("refuses paid v1 catalog drift in %s instead of changing an existing bucket", key => {
    const pro = PUBLIC_PLAN_CATALOG.find(p => p.id === "pro")!;
    const before = publicPaidAllowanceCandidate(basis(), coverage(), at());
    expect(before.kind).toBe("public_allowance_candidate");
    const current = pro[key];
    const restored = { ...pro };
    Object.assign(pro, { [key]: (current ?? 0) + 1000 });
    try {
      expect(publicPaidAllowanceCandidate(basis(), coverage(), at())).toEqual({ kind: "unavailable" });
    } finally { Object.assign(pro, restored); }
    expect(publicPaidAllowanceCandidate(basis(), coverage(), at())).toEqual(before);
  });
  it("keeps Free and paid buckets distinct and does not accept a TEST policy", () => {
    const free = publicFreeAllowanceCandidate({ policy: "axiom_public_anniversary_v1", enrollmentId: basis().enrollmentId, organizationId: basis().organizationId }, at());
    const paid = publicPaidAllowanceCandidate(basis(), coverage(), at());
    expect(free).not.toEqual(paid);
    expect(publicFreeAllowanceCandidate({ policy: "axiom_test_anniversary_v2", enrollmentId: "old", organizationId: "old" }, at())).toEqual({ kind: "unavailable" });
    expect(publicPaidAllowanceCandidate({ ...basis(), policy: "axiom_test_anniversary_v2" }, coverage(), at())).toEqual({ kind: "unavailable" });
  });
  it("rejects extra fields and accessors without invoking supplied getters", () => {
    let reads = 0;
    const c = { ...coverage() };
    Object.defineProperty(c, "amountCents", { enumerable: true, get() { reads++; return 8700; } });
    expect(publicPaidAllowanceCandidate(basis(), c, at())).toEqual({ kind: "unavailable" });
    expect(reads).toBe(0);
    expect(publicPaidAllowanceCandidate({ ...basis(), productionAuthorized: true }, coverage(), at())).toEqual({ kind: "unavailable" });
  });
  it("neither mutates inputs nor treats a valid arithmetic result as payment authority", () => {
    const b = Object.freeze(basis()), c = Object.freeze(coverage()), before = JSON.stringify({ b, c });
    expect(publicPaidAllowanceCandidate(b, c, at())).toMatchObject({ authoritative: false });
    expect(JSON.stringify({ b, c })).toBe(before);
    expect(publicPaidAllowanceCandidate(b, c, new Date(NaN))).toEqual({ kind: "unavailable" });
  });
});
