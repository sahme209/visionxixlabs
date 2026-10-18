import { describe, expect, it } from "vitest";
import { createAllowanceBasisV2, resolveAllowanceWindowV2, ANNIVERSARY_POLICY_V2, type AllowanceBasisV2, type PaidCoverageWindowV2 } from "../newTestSubscription/anniversaryWindow";
const scope = { runtimeId: "runtime", accountId: "acct_test", organizationId: "org", enrollmentDigest: "a".repeat(64) };
const origin = { intentId: "intent", sessionId: "cs_test", customerId: "cus_test", subscriptionId: "sub_test", createProofDigest: "e".repeat(64), firstCollectionDigest: "f".repeat(64) };
const terms = { catalogVersion: "axiom_public_test_v1" as const, planId: "pro" as const, interval: "monthly" as const, seatQuantity: 3, priceId: "price_pro", unitAmountCents: 2900, monthlyAICreditsCents: 3000, monthlyDeployments: 100 };
const paid = (anchor = "2026-10-18T14:15:16.000Z", annual = false) => createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "paid", origin, anchor, terms: annual ? { ...terms, interval: "annual", unitAmountCents: 27840 } : terms });
const coverage = (basis: AllowanceBasisV2, start: string, end: string, collectedAt = start): PaidCoverageWindowV2 => ({ version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "collected", status: "active", basisDigest: basis.digest, evidenceDigest: "b".repeat(64), serviceStart: start, serviceEnd: end, collectedAt });
const result = (basis: AllowanceBasisV2, start: string, end: string, now: string, collectedAt = start) => resolveAllowanceWindowV2(basis, coverage(basis, start, end, collectedAt), new Date(now));
function windowOf(value: ReturnType<typeof resolveAllowanceWindowV2>) { expect(value.kind).toBe("available"); if (value.kind !== "available") throw new Error("expected_candidate_window"); return value.window; }

describe("pure NEW TEST V2 anniversary window candidates (no permission or IO)", () => {
  it("selects a full paid pool for an ordinary first service month without reusing the Free bucket", () => {
    const free = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "free" });
    const before = windowOf(resolveAllowanceWindowV2(free, null, new Date("2026-10-18T14:15:15Z")));
    const after = windowOf(result(paid(), "2026-10-18T14:15:16.000Z", "2026-11-18T14:15:16.000Z", "2026-10-18T14:15:16Z"));
    expect(before).toMatchObject({ kind: "free", includedCents: 200, start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" });
    expect(after).toMatchObject({ kind: "paid", includedCents: 3000, start: "2026-10-18T14:15:16.000Z", end: "2026-11-18T14:15:16.000Z" });
    expect(after.bucketId).not.toBe(before.bucketId);
  });
  it("does not create a new included pool on calendar rollover inside the paid month", () => {
    const basis = paid(); const a = result(basis, basis.anchor!, "2026-11-18T14:15:16.000Z", "2026-10-31T23:59:59.999Z");
    const b = result(basis, basis.anchor!, "2026-11-18T14:15:16.000Z", "2026-11-01T00:00:00.000Z"); expect(a).toEqual(b);
  });
  it.each([
    ["2027-01-31T09:08:07.000Z", "2027-01-31T09:08:07.000Z", "2027-02-28T09:08:07.000Z"],
    ["2027-01-31T09:08:07.000Z", "2027-02-28T09:08:07.000Z", "2027-03-31T09:08:07.000Z"],
    ["2028-01-31T09:08:07.000Z", "2028-01-31T09:08:07.000Z", "2028-02-29T09:08:07.000Z"],
    ["2028-01-31T09:08:07.000Z", "2028-02-29T09:08:07.000Z", "2028-03-31T09:08:07.000Z"],
    ["2026-08-30T23:59:59.000Z", "2027-02-28T23:59:59.000Z", "2027-03-30T23:59:59.000Z"],
  ])("uses the original anchor %s for exact renewal %s → %s", (anchor, start, end) => {
    expect(windowOf(result(paid(anchor), start, end, start))).toMatchObject({ start, end, includedCents: 3000 });
  });
  it("uses half-open boundaries and requires new collected coverage at monthly renewal", () => {
    const basis = paid(); const start = basis.anchor!, end = "2026-11-18T14:15:16.000Z";
    expect(result(basis, start, end, "2026-10-18T14:15:15.999Z").kind).toBe("unavailable");
    expect(windowOf(result(basis, start, end, "2026-11-18T14:15:15.999Z"))).toMatchObject({ start, end });
    expect(result(basis, start, end, end).kind).toBe("unavailable");
    const next = windowOf(result(basis, end, "2026-12-18T14:15:16.000Z", end));
    expect(next.bucketId).not.toBe(windowOf(result(basis, start, end, start)).bucketId);
  });
  it("resolves twelve annual subwindows including the exact annual end without a thirteenth pool", () => {
    const basis = paid("2026-10-18T14:15:16.000Z", true); const start = basis.anchor!, end = "2027-10-18T14:15:16.000Z";
    const starts = ["2026-10-18", "2026-11-18", "2026-12-18", "2027-01-18", "2027-02-18", "2027-03-18", "2027-04-18", "2027-05-18", "2027-06-18", "2027-07-18", "2027-08-18", "2027-09-18"];
    const windows = starts.map(day => windowOf(result(basis, start, end, day + "T14:15:16.000Z")));
    expect(new Set(windows.map(w => w.bucketId)).size).toBe(12);
    expect(windows.map(w => w.start)).toEqual(starts.map(day => day + "T14:15:16.000Z"));
    expect(windows.every(w => w.includedCents === 3000)).toBe(true); expect(windows.at(-1)?.end).toBe(end);
    expect(result(basis, start, end, end).kind).toBe("unavailable");
  });
  it("preserves original leap-day monthly anchors across annual renewals", () => {
    const basis = paid("2028-02-29T12:00:00.000Z", true);
    expect(windowOf(result(basis, basis.anchor!, "2029-02-28T12:00:00.000Z", "2029-02-28T11:59:59.999Z"))).toMatchObject({ start: "2029-01-29T12:00:00.000Z", end: "2029-02-28T12:00:00.000Z" });
    expect(windowOf(result(basis, "2029-02-28T12:00:00.000Z", "2030-02-28T12:00:00.000Z", "2029-03-01T00:00:00.000Z"))).toMatchObject({ start: "2029-02-28T12:00:00.000Z", end: "2029-03-29T12:00:00.000Z" });
    expect(windowOf(result(basis, "2031-02-28T12:00:00.000Z", "2032-02-29T12:00:00.000Z", "2032-02-29T11:59:59.999Z"))).toMatchObject({ end: "2032-02-29T12:00:00.000Z" });
  });
  it("does not change a bucket for same-window replacement collection or later recovery", () => {
    const basis = paid(), start = basis.anchor!, end = "2026-11-18T14:15:16.000Z", now = new Date("2026-10-24T00:00:00Z");
    const first = resolveAllowanceWindowV2(basis, coverage(basis, start, end), now);
    const replacementCoverage = coverage(basis, start, end, "2026-10-23T00:00:00.000Z");
    if (replacementCoverage.kind !== "collected") throw new Error("expected_collected_fixture");
    const replacement = resolveAllowanceWindowV2(basis, { ...replacementCoverage, evidenceDigest: "c".repeat(64) }, now);
    expect(first).toEqual(replacement);
    expect(result(basis, start, end, "2026-10-22T00:00:00Z", "2026-10-23T00:00:00.000Z").kind).toBe("unavailable");
  });
  it("keeps policy v2 distinct from original catalog v1 and copies immutable original terms", () => {
    const input = { ...scope, version: 2 as const, policy: ANNIVERSARY_POLICY_V2, kind: "paid" as const, origin, anchor: "2026-10-18T14:15:16.000Z", terms: { ...terms } };
    const basis = createAllowanceBasisV2(input); input.anchor = "2026-10-19T14:15:16.000Z"; input.terms.seatQuantity = 4;
    expect(basis).toMatchObject({ policy: "axiom_test_anniversary_v2", anchor: "2026-10-18T14:15:16.000Z", terms: { catalogVersion: "axiom_public_test_v1", seatQuantity: 3 } });
    expect(Object.isFrozen(basis)).toBe(true); if (basis.kind === "paid") expect(Object.isFrozen(basis.terms)).toBe(true);
  });
  it.each(["runtimeId", "accountId", "organizationId", "enrollmentDigest"] as const)("binds bucket identity to %s", key => {
    const original = paid(), start = original.anchor!, end = "2026-11-18T14:15:16.000Z";
    const foreign = createAllowanceBasisV2({ ...scope, [key]: key === "enrollmentDigest" ? "d".repeat(64) : "foreign", version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "paid", origin, anchor: start, terms });
    expect(windowOf(result(original, start, end, start)).bucketId).not.toBe(windowOf(result(foreign, start, end, start)).bucketId);
    expect(resolveAllowanceWindowV2(foreign, coverage(original, start, end), new Date(start)).kind).toBe("unavailable");
  });
  it.each([
    ["2026-10-19T14:15:16.000Z", "2026-11-19T14:15:16.000Z"],
    ["2026-10-18T14:15:16.000Z", "2026-12-18T14:15:16.000Z"],
    ["2026-09-18T14:15:16.000Z", "2026-10-18T14:15:16.000Z"],
    ["2026-10-18T14:15:16.000Z", "2026-11-18T14:15:17.000Z"],
  ])("denies unsupported service period %s → %s", (start, end) => expect(result(paid(), start, end, start).kind).toBe("unavailable"));
  it("binds the immutable original subscription and first proof provenance without using a replacement invoice", () => {
    const first = paid(), start = first.anchor!, end = "2026-11-18T14:15:16.000Z";
    const changed = createAllowanceBasisV2({ ...scope, version: 2, policy: ANNIVERSARY_POLICY_V2, kind: "paid", anchor: start, origin: { ...origin, subscriptionId: "sub_foreign" }, terms });
    expect(first.digest).not.toBe(changed.digest);
    expect(windowOf(result(first, start, end, start)).bucketId).not.toBe(windowOf(result(changed, start, end, start)).bucketId);
  });
  it("does not accept a monthly-sized or shifted annual paid service period", () => {
    const basis = paid("2026-10-18T14:15:16.000Z", true);
    for (const [start, end] of [[basis.anchor!, "2026-11-18T14:15:16.000Z"], ["2026-11-18T14:15:16.000Z", "2027-11-18T14:15:16.000Z"]]) expect(result(basis, start, end, start).kind).toBe("unavailable");
  });
  it("denies missing/unavailable, foreign, inactive or malformed candidate proof without falling back to Free", () => {
    const basis = paid(), c = coverage(basis, basis.anchor!, "2026-11-18T14:15:16.000Z"), now = new Date(basis.anchor!);
    for (const candidate of [null, { kind: "unavailable" as const }, { ...c, basisDigest: "f".repeat(64) }, { ...c, evidenceDigest: "invalid" }, { ...c, status: "past_due" }, { ...c, version: 1 }, { ...c, policy: "axiom_public_test_v1" }, { ...c, collectedAt: "invalid" }]) expect(resolveAllowanceWindowV2(basis, candidate as PaidCoverageWindowV2 | null, now).kind).toBe("unavailable");
    expect(resolveAllowanceWindowV2(basis, c, new Date("invalid")).kind).toBe("unavailable");
    expect(resolveAllowanceWindowV2({ ...basis, digest: "f".repeat(64) }, c, now).kind).toBe("unavailable");
  });
});
