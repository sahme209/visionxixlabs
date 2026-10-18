import { ANNIVERSARY_POLICY_V2, validAnniversaryServicePeriod } from "./anniversaryWindow";
import { supportedChargeMethodType } from "./chargeSource";
import { createHash } from "node:crypto";
import { PUBLIC_PLAN_CATALOG } from "../publicPlanCatalog";
import type { Contract, Intent } from "./service";

export type PaidIdentity = Pick<Contract, "runtimeId" | "accountId" | "organizationId" | "originatingIntentId" | "sessionId" | "customerId" | "subscriptionId" | "planId" | "seatQuantity"> & { interval: "monthly" | "annual"; priceId: string; unitAmountCents: number };
export type EvidenceInput = PaidIdentity & { invoiceId: string; lineId: string; subscriptionItemId: string; paymentId: string; paymentIntentId: string; chargeId: string; paymentMethodType: string; currency: "usd"; amountCents: number; collectedAt: string; serviceStart: string; serviceEnd: string };
export type AnniversaryCollectionContext = { policy: typeof ANNIVERSARY_POLICY_V2; enrollmentDigest: string; originalAnchor: string; originalCreateProofDigest: string };
export type PaidInvoiceEvidence = EvidenceInput & ({ version: 1; digest: string } | AnniversaryCollectionContext & { version: 2; digest: string });
export type CollectionResult = { kind: "collected"; evidence: PaidInvoiceEvidence } | { kind: "unavailable"; reason: "not_collected" | "unsupported_collection" | "refunded_or_disputed" | "unsupported_terms" | "replay_unavailable" };
export type CoverageObservation = { eventToken: string; latestInvoiceId: string | null; currentPeriodStart: string; currentPeriodEnd: string; collection: CollectionResult; invalidatingEventId?: string };
function unavailable(): never { throw new Error("paid_coverage_unavailable"); }
const scopeKeys = ["runtimeId", "accountId", "organizationId", "originatingIntentId", "sessionId", "customerId", "subscriptionId", "planId", "seatQuantity", "interval", "priceId", "unitAmountCents"] as const;
export function paidIdentity(contract: Contract, intent: Intent): PaidIdentity { return { runtimeId: contract.runtimeId, accountId: contract.accountId, organizationId: contract.organizationId, originatingIntentId: contract.originatingIntentId, sessionId: contract.sessionId, customerId: contract.customerId, subscriptionId: contract.subscriptionId, planId: contract.planId, seatQuantity: contract.seatQuantity, interval: intent.terms.interval, priceId: intent.terms.priceId, unitAmountCents: intent.terms.unitAmountCents }; }
function iso(value: string): number { const n = new Date(value).getTime(); if (!Number.isFinite(n) || new Date(n).toISOString() !== value) unavailable(); return n; }
function normalizeEvidence(input: EvidenceInput, anniversary?: AnniversaryCollectionContext): EvidenceInput {
  if (!input || scopeKeys.some(key => input[key] === undefined) || [...scopeKeys.filter(k => !["seatQuantity", "unitAmountCents"].includes(k)), "invoiceId", "lineId", "subscriptionItemId", "paymentId", "paymentIntentId", "chargeId"].some(k => typeof input[k as keyof EvidenceInput] !== "string" || !(input[k as keyof EvidenceInput] as string).trim())) unavailable();
  const catalog = PUBLIC_PLAN_CATALOG.find(p => p.id !== "free" && p.id === input.planId);
  const annual = input.interval === "annual";
  const expectedUnit = catalog && (annual ? catalog.annualPricePerUserCents * 12 : catalog.monthlyPricePerUserCents);
  if (!catalog || !["monthly", "annual"].includes(input.interval) || !supportedChargeMethodType(input.paymentMethodType) || input.currency !== "usd" || !Number.isSafeInteger(input.seatQuantity) || input.seatQuantity < 1 || input.unitAmountCents !== expectedUnit || !Number.isSafeInteger(input.amountCents) || input.amountCents < 1 || input.amountCents !== input.unitAmountCents * input.seatQuantity) unavailable();
  const start = new Date(iso(input.serviceStart)); const end = iso(input.serviceEnd); iso(input.collectedAt);
  if (anniversary) {
    if (anniversary.policy !== ANNIVERSARY_POLICY_V2 || !/^[a-f0-9]{64}$/.test(anniversary.enrollmentDigest) || !/^[a-f0-9]{64}$/.test(anniversary.originalCreateProofDigest)
      || !validAnniversaryServicePeriod(anniversary.originalAnchor, input.interval, input.serviceStart, input.serviceEnd)) unavailable();
  } else if (start.getTime() !== Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1) || end !== Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + (annual ? 12 : 1), 1)) unavailable();
  // Canonical closed schema: extra caller fields do not enter the digest.
  const normalized: EvidenceInput = { runtimeId: input.runtimeId, accountId: input.accountId, organizationId: input.organizationId, originatingIntentId: input.originatingIntentId, sessionId: input.sessionId, customerId: input.customerId, subscriptionId: input.subscriptionId, planId: input.planId, seatQuantity: input.seatQuantity, interval: input.interval, priceId: input.priceId, unitAmountCents: input.unitAmountCents, invoiceId: input.invoiceId, lineId: input.lineId, subscriptionItemId: input.subscriptionItemId, paymentId: input.paymentId, paymentIntentId: input.paymentIntentId, chargeId: input.chargeId, paymentMethodType: input.paymentMethodType, currency: input.currency, amountCents: input.amountCents, collectedAt: input.collectedAt, serviceStart: input.serviceStart, serviceEnd: input.serviceEnd };
  return normalized;
}
export function collectedEvidence(input: EvidenceInput): PaidInvoiceEvidence {
  const normalized = normalizeEvidence(input);
  return { ...normalized, version: 1, digest: createHash("sha256").update(JSON.stringify(normalized)).digest("hex") };
}
export function collectedEvidenceV2(input: EvidenceInput, context: AnniversaryCollectionContext): PaidInvoiceEvidence & { version: 2 } {
  const normalized = normalizeEvidence(input, context);
  const body = { ...normalized, version: 2 as const, policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: context.enrollmentDigest, originalAnchor: context.originalAnchor, originalCreateProofDigest: context.originalCreateProofDigest };
  return { ...body, digest: createHash("sha256").update(JSON.stringify(body)).digest("hex") };
}
export function validateEvidence(identity: PaidIdentity, evidence: PaidInvoiceEvidence): void {
  if (!evidence || ![1, 2].includes(evidence.version) || scopeKeys.some(k => identity[k] !== evidence[k]) || (evidence.version === 2 ? collectedEvidenceV2(evidence, evidence) : collectedEvidence(evidence)).digest !== evidence.digest) unavailable();
}
export function validateObservation(identity: PaidIdentity, eventToken: string, o: CoverageObservation): void {
  if (!o || o.eventToken !== eventToken || !eventToken || !(o.latestInvoiceId === null || typeof o.latestInvoiceId === "string" && !!o.latestInvoiceId.trim())) unavailable();
  if (iso(o.currentPeriodStart) >= iso(o.currentPeriodEnd)) unavailable();
  if (o.collection?.kind === "collected") {
    const e = o.collection.evidence; validateEvidence(identity, e);
    if (e.invoiceId !== o.latestInvoiceId || e.serviceStart !== o.currentPeriodStart || e.serviceEnd !== o.currentPeriodEnd) unavailable();
  } else if (o.collection?.kind !== "unavailable" || !["not_collected", "unsupported_collection", "refunded_or_disputed", "unsupported_terms", "replay_unavailable"].includes(o.collection.reason)) unavailable();
}
/** Paid and inactive Free policies are explicit branches. No missing-proof fallback. */
export function paidAccess(identity: PaidIdentity, status: string, eventToken: string, observation: CoverageObservation | null, originallyCollected: boolean, now: Date): { kind: "paid" | "free"; monthlyAICreditsCents: number; month: string } {
  if (!originallyCollected || !observation || !Number.isFinite(now.getTime())) unavailable();
  validateObservation(identity, eventToken, observation);
  if (observation.collection.kind === "unavailable" && ["unsupported_terms", "replay_unavailable"].includes(observation.collection.reason)) unavailable();
  const month = now.toISOString().slice(0, 7);
  if (["past_due", "canceled", "trialing", "no_plan"].includes(status)) return { kind: "free", monthlyAICreditsCents: 200, month };
  if (status !== "active" || observation.collection.kind !== "collected") unavailable();
  const evidence = observation.collection.evidence;
  if (evidence.version !== 1) unavailable(); // V2 requires authoritative enrollment and its own window resolver.
  if (now.getTime() < iso(evidence.serviceStart) || now.getTime() >= iso(evidence.serviceEnd) || now.getTime() < iso(evidence.collectedAt)) unavailable();
  const plan = PUBLIC_PLAN_CATALOG.find(p => p.id === identity.planId); if (!plan) unavailable();
  return { kind: "paid", monthlyAICreditsCents: plan.monthlyAiCreditCents * identity.seatQuantity, month };
}
