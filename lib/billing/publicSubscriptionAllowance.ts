import { createHash } from "node:crypto";
import { PUBLIC_PLAN_CATALOG } from "./publicPlanCatalog";
import { validAnniversaryServicePeriod } from "./newTestSubscription/anniversaryWindow";

/** Production policy arithmetic only. These candidates are deliberately NOT
 * PricingPlan objects or TEST capabilities. The production store must verify
 * new-customer enrollment, immutable original SDK proof and current collected
 * invoice evidence before using a candidate in its locked admission statement.
 * No route, flag, provider factory, balance or existing customer is changed. */
export type PublicPaidAllowanceBasis = Readonly<{ policy: "axiom_public_anniversary_v1"; enrollmentId: string; organizationId: string; accountId: string; contractId: string; subscriptionId: string; planId: "pro" | "enterprise"; interval: "monthly" | "annual"; paidSeats: number; priceId: string; unitAmountCents: number; anchor: string; originalCreateProofDigest: string; firstCollectionDigest: string }>;
export type PublicCollectedCoverage = Readonly<{ kind: "collected"; livemode: boolean; status: string; enrollmentId: string; organizationId: string; accountId: string; contractId: string; subscriptionId: string; priceId: string; paidSeats: number; originalCreateProofDigest: string; invoiceId: string; evidenceDigest: string; amountCents: number; serviceStart: string; serviceEnd: string; collectedAt: string }>;

export type PublicAllowanceCandidate = Readonly<{
  kind: "public_allowance_candidate"; authoritative: false; policy: "axiom_public_anniversary_v1";
  enrollmentId: string; organizationId: string; planId: "free" | "pro" | "enterprise";
  start: string; end: string; includedCents: number; seats: number; monthlyDeployments: number;
  basisDigest: string; bucketId: string;
}>;
type Result = PublicAllowanceCandidate | { kind: "unavailable" };
// A later catalog revision must use a new policy/basis; it cannot reinterpret
// an already identified v1 bucket, even if the charged price did not change.
const paidV1 = Object.freeze({
  pro: Object.freeze({ monthlyPricePerUserCents: 2900, annualPricePerUserCents: 2320, monthlyAiCreditCents: 1000, monthlyDeployments: 100 }),
  enterprise: Object.freeze({ monthlyPricePerUserCents: 7900, annualPricePerUserCents: 6320, monthlyAiCreditCents: 3000, monthlyDeployments: 500 }),
});
const unavailable = (): Result => ({ kind: "unavailable" });
const hash = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
const identifier = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_:@.-]{1,200}$/.test(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
function data(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("invalid");
  if (Reflect.ownKeys(value).length !== fields.length) throw Error("invalid");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (fields.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], "value"))) throw Error("invalid");
  return Object.fromEntries(fields.map(key => [key, descriptors[key].value]));
}
function date(value: unknown): Date {
  if (typeof value !== "string") throw Error("invalid");
  const d = new Date(value);
  if (!Number.isFinite(d.getTime()) || d.toISOString() !== value || d.getUTCFullYear() < 1970 || d.getUTCFullYear() > 9999) throw Error("invalid");
  return d;
}
function instant(now: Date) {
  if (!(now instanceof Date)) throw Error("invalid");
  return date(now.toISOString());
}
function boundary(anchor: Date, offset: number): Date {
  const index = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + offset, year = Math.floor(index / 12), month = index % 12;
  if (!Number.isSafeInteger(offset) || offset < 0 || year < 1970 || year > 9999) throw Error("invalid");
  return new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate()), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds()));
}
function candidate(enrollmentId: string, organizationId: string, planId: "free" | "pro" | "enterprise", start: Date, end: Date, includedCents: number, seats: number, monthlyDeployments: number, basis: unknown): Result {
  const basisDigest = hash(basis), bounds = { start: start.toISOString(), end: end.toISOString() };
  return Object.freeze({ kind: "public_allowance_candidate", authoritative: false, policy: "axiom_public_anniversary_v1", enrollmentId, organizationId, planId, ...bounds, includedCents, seats, monthlyDeployments, basisDigest,
    bucketId: hash({ policy: "axiom_public_anniversary_v1", enrollmentId, organizationId, basisDigest, ...bounds }) });
}
/** Free is an explicit new-public enrollment candidate, never a missing paid
 * contract fallback. The store still has to establish that enrollment. */
export function publicFreeAllowanceCandidate(enrollment: unknown, now: Date): Result {
  try {
    const e = data(enrollment, ["policy", "enrollmentId", "organizationId"]), at = instant(now);
    if (e.policy !== "axiom_public_anniversary_v1" || !identifier(e.enrollmentId) || !identifier(e.organizationId)) return unavailable();
    const plan = PUBLIC_PLAN_CATALOG.find(p => p.id === "free");
    if (!plan || plan.monthlyAiCreditCents !== 200 || plan.includedSeats !== 2 || plan.monthlyDeployments !== 10 || plan.monthlyPricePerUserCents !== 0 || plan.annualPricePerUserCents !== 0 || plan.aiCreditBasis !== "organization") return unavailable();
    return candidate(e.enrollmentId, e.organizationId, "free", new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)), new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1)), 200, 2, 10, e);
  } catch { return unavailable(); }
}
/** Full monthly base only: prior Free spending and purchased-credit balances
 * are intentionally absent from this arithmetic. Attribution/remaining balance
 * must be resolved separately without transferring the old Free bucket. */
/** expectedLivemode comes only from the server's verified account binding; the default remains live. */
export function publicPaidAllowanceCandidate(basis: unknown, coverage: unknown, now: Date, expectedLivemode = true): Result {
  try {
    const b = data(basis, ["policy", "enrollmentId", "organizationId", "accountId", "contractId", "subscriptionId", "planId", "interval", "paidSeats", "priceId", "unitAmountCents", "anchor", "originalCreateProofDigest", "firstCollectionDigest"]);
    const c = data(coverage, ["kind", "livemode", "status", "enrollmentId", "organizationId", "accountId", "contractId", "subscriptionId", "priceId", "paidSeats", "originalCreateProofDigest", "invoiceId", "evidenceDigest", "amountCents", "serviceStart", "serviceEnd", "collectedAt"]);
    const at = instant(now), anchor = date(b.anchor), start = date(c.serviceStart), end = date(c.serviceEnd), collected = date(c.collectedAt);
    const ids = ["enrollmentId", "organizationId", "accountId", "contractId", "subscriptionId", "priceId"];
    if (b.policy !== "axiom_public_anniversary_v1" || ids.some(key => !identifier(b[key]) || b[key] !== c[key])
      || typeof b.accountId !== "string" || !b.accountId.startsWith("acct_") || typeof b.priceId !== "string" || !b.priceId.startsWith("price_")
      || !identifier(c.invoiceId) || !digest(b.originalCreateProofDigest) || c.originalCreateProofDigest !== b.originalCreateProofDigest || !digest(b.firstCollectionDigest) || !digest(c.evidenceDigest)
      || !["pro", "enterprise"].includes(String(b.planId)) || !["monthly", "annual"].includes(String(b.interval))
      || !Number.isSafeInteger(b.paidSeats) || (b.paidSeats as number) < 1 || c.paidSeats !== b.paidSeats
      || typeof expectedLivemode !== "boolean" || c.kind !== "collected" || c.livemode !== expectedLivemode || c.status !== "active" || anchor.getUTCMilliseconds() !== 0
      || start < anchor || at < start || at >= end || collected < start || collected > at
      || c.serviceStart === b.anchor && c.evidenceDigest !== b.firstCollectionDigest
      || !validAnniversaryServicePeriod(b.anchor as string, b.interval as "monthly" | "annual", c.serviceStart as string, c.serviceEnd as string)) return unavailable();
    const plan = PUBLIC_PLAN_CATALOG.find(p => p.id === b.planId);
    const terms = paidV1[b.planId as "pro" | "enterprise"];
    if (!plan || !terms || plan.monthlyPricePerUserCents !== terms.monthlyPricePerUserCents || plan.annualPricePerUserCents !== terms.annualPricePerUserCents
      || plan.monthlyAiCreditCents !== terms.monthlyAiCreditCents || plan.monthlyDeployments !== terms.monthlyDeployments || plan.aiCreditBasis !== "paid_seat" || plan.includedSeats !== null) return unavailable();
    const expected = b.interval === "annual" ? terms.annualPricePerUserCents * 12 : terms.monthlyPricePerUserCents;
    const seats = b.paidSeats as number, included = terms.monthlyAiCreditCents * seats, paid = expected * seats;
    if (b.unitAmountCents !== expected || !Number.isSafeInteger(included) || !Number.isSafeInteger(paid) || c.amountCents !== paid) return unavailable();
    let n = (at.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + at.getUTCMonth() - anchor.getUTCMonth();
    if (boundary(anchor, n) > at) n--;
    const windowStart = boundary(anchor, n), windowEnd = boundary(anchor, n + 1);
    if (windowStart < start || windowEnd > end || at < windowStart || at >= windowEnd) return unavailable();
    return candidate(b.enrollmentId as string, b.organizationId as string, b.planId as "pro" | "enterprise", windowStart, windowEnd, included, seats, terms.monthlyDeployments, { contract: b, terms });
  } catch { return unavailable(); }
}
