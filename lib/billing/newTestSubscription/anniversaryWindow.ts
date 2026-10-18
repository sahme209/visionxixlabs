import { createHash } from "node:crypto";
import { PUBLIC_PLAN_CATALOG } from "../publicPlanCatalog";
import { NEW_TEST_CATALOG_VERSION, type NewTestTerms } from "../newTestSubscriptionContract";

export const ANNIVERSARY_POLICY_V2 = "axiom_test_anniversary_v2" as const;
type Scope = { runtimeId: string; accountId: string; organizationId: string; enrollmentDigest: string };
type Common = Scope & { version: 2; policy: typeof ANNIVERSARY_POLICY_V2 };
export type FreeBasisInputV2 = Common & { kind: "free" };
type OriginalPaidProvenanceV2 = Readonly<{ intentId: string; sessionId: string; customerId: string; subscriptionId: string; createProofDigest: string; firstCollectionDigest: string }>;
export type PaidBasisInputV2 = Common & { kind: "paid"; origin: OriginalPaidProvenanceV2; anchor: string; terms: Readonly<NewTestTerms> };
export type AllowanceBasisV2 = Readonly<(FreeBasisInputV2 | PaidBasisInputV2) & { digest: string }>;
export type PaidCoverageWindowV2 = { version: 2; policy: typeof ANNIVERSARY_POLICY_V2; kind: "collected"; status: string; basisDigest: string; evidenceDigest: string; serviceStart: string; serviceEnd: string; collectedAt: string } | { kind: "unavailable" };
export type AllowanceWindowV2 = { version: 2; policy: typeof ANNIVERSARY_POLICY_V2; bucketId: string; basisDigest: string; kind: "free" | "paid"; start: string; end: string; includedCents: number };
export type WindowResultV2 = { kind: "available"; window: AllowanceWindowV2 } | { kind: "unavailable"; reason: "invalid_basis" | "invalid_clock" | "coverage_unavailable" | "invalid_period" | "not_current" };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const digest = (value: string) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function invalidBasis(): never { throw new Error("allowance_basis_invalid"); }
function iso(value: string): Date {
  const date = new Date(value);
  if (typeof value !== "string" || !Number.isFinite(date.getTime()) || date.toISOString() !== value || date.getUTCFullYear() < 1970 || date.getUTCFullYear() > 9999) throw new Error("allowance_time_invalid");
  return date;
}
export function createAllowanceBasisV2(input: PaidBasisInputV2): Readonly<PaidBasisInputV2 & { digest: string }>;
export function createAllowanceBasisV2(input: FreeBasisInputV2): Readonly<FreeBasisInputV2 & { digest: string }>;
export function createAllowanceBasisV2(input: FreeBasisInputV2 | PaidBasisInputV2): AllowanceBasisV2;
/** Structural, canonical arithmetic input only. A valid digest is not enrollment,
 * original-attempt, payment or admission proof; trusted IO must verify all of it. */
export function createAllowanceBasisV2(input: FreeBasisInputV2 | PaidBasisInputV2): AllowanceBasisV2 {
  if (!input || input.version !== 2 || input.policy !== ANNIVERSARY_POLICY_V2 || !digest(input.enrollmentDigest)
    || [input.runtimeId, input.accountId, input.organizationId].some(value => typeof value !== "string" || !value.trim())) invalidBasis();
  const common: Common = { version: 2, policy: ANNIVERSARY_POLICY_V2, runtimeId: input.runtimeId, accountId: input.accountId, organizationId: input.organizationId, enrollmentDigest: input.enrollmentDigest };
  if (input.kind === "free") { const body: FreeBasisInputV2 = { ...common, kind: "free" }; return Object.freeze({ ...body, digest: hash(body) }); }
  if (input.kind !== "paid") invalidBasis();
  try { if (iso(input.anchor).getUTCMilliseconds() !== 0) invalidBasis(); } catch { invalidBasis(); }
  const o = input.origin;
  if (!o || [o.intentId, o.sessionId, o.customerId, o.subscriptionId].some(value => typeof value !== "string" || !value.trim()) || !digest(o.createProofDigest) || !digest(o.firstCollectionDigest)) invalidBasis();
  const origin: OriginalPaidProvenanceV2 = Object.freeze({ intentId: o.intentId, sessionId: o.sessionId, customerId: o.customerId, subscriptionId: o.subscriptionId, createProofDigest: o.createProofDigest, firstCollectionDigest: o.firstCollectionDigest });
  const t = input.terms, plan = PUBLIC_PLAN_CATALOG.find(p => p.id !== "free" && p.id === t?.planId);
  if (!t || !plan || t.catalogVersion !== NEW_TEST_CATALOG_VERSION || !["monthly", "annual"].includes(t.interval)
    || !Number.isSafeInteger(t.seatQuantity) || t.seatQuantity < 1 || typeof t.priceId !== "string" || !t.priceId.trim()
    || t.unitAmountCents !== (t.interval === "annual" ? plan.annualPricePerUserCents * 12 : plan.monthlyPricePerUserCents)
    || t.monthlyAICreditsCents !== plan.monthlyAiCreditCents * t.seatQuantity || !Number.isSafeInteger(t.monthlyAICreditsCents)
    || !Number.isSafeInteger(t.unitAmountCents * t.seatQuantity) || t.monthlyDeployments !== plan.monthlyDeployments) invalidBasis();
  const terms: Readonly<NewTestTerms> = Object.freeze({ catalogVersion: NEW_TEST_CATALOG_VERSION, planId: t.planId, interval: t.interval, seatQuantity: t.seatQuantity, priceId: t.priceId, unitAmountCents: t.unitAmountCents, monthlyAICreditsCents: t.monthlyAICreditsCents, monthlyDeployments: t.monthlyDeployments });
  const body: PaidBasisInputV2 = { ...common, kind: "paid", origin, anchor: input.anchor, terms };
  return Object.freeze({ ...body, digest: hash(body) });
}
function monthIndex(date: Date): number { return date.getUTCFullYear() * 12 + date.getUTCMonth(); }
/** F(n) always uses the original day/time. February clamping never becomes
 * March's anchor, including leap-day annual renewals. */
function boundary(anchor: Date, index: number): Date {
  const month = monthIndex(anchor) + index, year = Math.floor(month / 12), monthOfYear = month % 12;
  if (!Number.isSafeInteger(index) || index < 0 || year < 1970 || year > 9999) throw new Error("allowance_time_invalid");
  const last = new Date(Date.UTC(year, monthOfYear + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthOfYear, Math.min(anchor.getUTCDate(), last), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds()));
}
/** Exact complete service periods measured from the immutable original anchor. */
export function validAnniversaryServicePeriod(anchorISO: string, interval: "monthly" | "annual", startISO: string, endISO: string): boolean {
  try {
    const anchor = iso(anchorISO), start = iso(startISO), end = iso(endISO), n = monthIndex(start) - monthIndex(anchor), count = interval === "annual" ? 12 : 1;
    return ["monthly", "annual"].includes(interval) && anchor.getUTCMilliseconds() === 0 && n >= 0 && (count !== 12 || n % 12 === 0)
      && boundary(anchor, n).getTime() === start.getTime() && boundary(anchor, n + count).getTime() === end.getTime();
  } catch { return false; }
}
function available(basis: AllowanceBasisV2, start: Date, end: Date, includedCents: number): WindowResultV2 {
  const bounds = { start: start.toISOString(), end: end.toISOString() };
  const bucketId = hash({ version: 2, enrollmentDigest: basis.enrollmentDigest, basisDigest: basis.digest, kind: basis.kind, ...bounds });
  return { kind: "available", window: { version: 2, policy: ANNIVERSARY_POLICY_V2, bucketId, basisDigest: basis.digest, kind: basis.kind, ...bounds, includedCents } };
}
/** Pure candidates only. This function must never become a runtime selector or
 * permission fallback; it has no payment, storage or ledger authority. */
export function resolveAllowanceWindowV2(basis: AllowanceBasisV2, coverage: PaidCoverageWindowV2 | null, now: Date): WindowResultV2 {
  try { if (createAllowanceBasisV2(basis).digest !== basis.digest) return { kind: "unavailable", reason: "invalid_basis" }; }
  catch { return { kind: "unavailable", reason: "invalid_basis" }; }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || now.getUTCFullYear() < 1970 || now.getUTCFullYear() > 9999) return { kind: "unavailable", reason: "invalid_clock" };
  if (basis.kind === "free") {
    if (coverage !== null) return { kind: "unavailable", reason: "coverage_unavailable" };
    // This version freezes the approved Free amount; a future catalog change
    // needs a new policy version, not reinterpretation of an existing basis.
    if (PUBLIC_PLAN_CATALOG.find(p => p.id === "free")?.monthlyAiCreditCents !== 200) return { kind: "unavailable", reason: "invalid_basis" };
    return available(basis, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)), 200);
  }
  if (!coverage || coverage.kind !== "collected" || coverage.version !== 2 || coverage.policy !== ANNIVERSARY_POLICY_V2 || coverage.status !== "active"
    || coverage.basisDigest !== basis.digest || !digest(coverage.evidenceDigest)) return { kind: "unavailable", reason: "coverage_unavailable" };
  try {
    const anchor = iso(basis.anchor), start = iso(coverage.serviceStart), end = iso(coverage.serviceEnd), collected = iso(coverage.collectedAt);
    const serviceIndex = monthIndex(start) - monthIndex(anchor), count = basis.terms.interval === "annual" ? 12 : 1;
    if (serviceIndex < 0 || count === 12 && serviceIndex % 12 !== 0 || boundary(anchor, serviceIndex).getTime() !== start.getTime()
      || boundary(anchor, serviceIndex + count).getTime() !== end.getTime()) return { kind: "unavailable", reason: "invalid_period" };
    if (now < start || now >= end || now < collected) return { kind: "unavailable", reason: "not_current" };
    let current = monthIndex(now) - monthIndex(anchor);
    if (now < boundary(anchor, current)) current--;
    if (current < serviceIndex || current >= serviceIndex + count) return { kind: "unavailable", reason: "invalid_period" };
    return available(basis, boundary(anchor, current), boundary(anchor, current + 1), basis.terms.monthlyAICreditsCents);
  } catch { return { kind: "unavailable", reason: "invalid_period" }; }
}
