import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createEnrollmentV2, originalCreateProofDigest, paidBasisForOriginalCollection, fixtureAllocationDDL, readFixtureEnrollment } from "../newTestSubscription/fixtureAllocation";
import { ANNIVERSARY_POLICY_V2 } from "../newTestSubscription/anniversaryWindow";
import { collectedEvidenceV2 } from "../newTestSubscription/paidCoverage";
function evidenceInput() { return { runtimeId: "runtime", accountId: "acct_test", organizationId: "org", originatingIntentId: "intent", sessionId: "cs_test", customerId: "cus_test", subscriptionId: "sub_test", planId: "pro" as const, interval: "monthly" as const, seatQuantity: 3, priceId: "price_test", unitAmountCents: 2900, invoiceId: "in_test", lineId: "il_test", subscriptionItemId: "si_test", paymentId: "inpay_test", paymentIntentId: "pi_test", chargeId: "ch_test", paymentMethodType: "card", currency: "usd" as const, amountCents: 8700, collectedAt: "2026-10-18T14:15:16.000Z", serviceStart: "2026-10-18T14:15:16.000Z", serviceEnd: "2026-11-18T14:15:16.000Z" }; }
import type { Intent } from "../newTestSubscription/service";
import type { Prisma } from "@prisma/client";
const scope = { runtimeId: "runtime", accountId: "acct_test", organizationId: "org" };
function prepared() {
  const enrollment = createEnrollmentV2(scope);
  const terms: Intent["terms"] = { catalogVersion: "axiom_public_test_v1", planId: "pro", interval: "monthly", seatQuantity: 3, priceId: "price_test", unitAmountCents: 2900, monthlyAICreditsCents: 3000, monthlyDeployments: 100 };
  const allowanceV2: NonNullable<Intent["allowanceV2"]> = { policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest };
  const canonicalRequest = JSON.stringify({ mode: "subscription", line_items: [{ price: terms.priceId, quantity: terms.seatQuantity }], customer_email: "fixture@example.invalid", success_url: "https://isolated.invalid/success", cancel_url: "https://isolated.invalid/cancel",
    metadata: { organizationId: scope.organizationId, catalogVersion: terms.catalogVersion, intentId: "intent", allowancePolicy: allowanceV2.policy, allowanceEnrollmentDigest: enrollment.digest },
    subscription_data: { metadata: { organizationId: scope.organizationId, catalogVersion: terms.catalogVersion, intentId: "intent", planId: terms.planId, billingInterval: terms.interval, allowancePolicy: allowanceV2.policy, allowanceEnrollmentDigest: enrollment.digest } } });
  const requestDigest = createHash("sha256").update(canonicalRequest).digest("hex"), createdAtMs = Date.parse("2026-10-18T14:15:15.000Z");
  const proof = { ...scope, sessionId: "cs_test", outboundRequestKey: "key", outboundRequestDigest: requestDigest, requestId: "req", statusCode: 200 };
  const intent: Intent = Object.freeze({ id: "intent", ...scope, livemode: false, terms, sessionId: "cs_test", originalCreateProof: proof, providerIdempotencyKey: "key", requestDigest, allowanceV2,
    clientIntentKey: "fixture-intent-12345678", canonicalRequest, createdAtMs, retryNotAfterMs: createdAtMs + 23 * 3600000, state: "session_confirmed", email: "fixture@example.invalid", customerId: null, subscriptionId: null, revision: 2 });
  const input = { ...evidenceInput(), serviceStart: "2026-10-18T14:15:16.000Z", serviceEnd: "2026-11-18T14:15:16.000Z" };
  const evidence = collectedEvidenceV2(input, { policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: enrollment.digest, originalAnchor: input.serviceStart, originalCreateProofDigest: originalCreateProofDigest(intent) });
  return { enrollment, intent, evidence };
}
describe("owned V2 enrollment and original anchor storage contract", () => {
  it("constructs a complete frozen original intent with a canonical request digest", () => {
    const { intent } = prepared();
    expect(intent).toMatchObject({ state: "session_confirmed", revision: 2, clientIntentKey: "fixture-intent-12345678", email: "fixture@example.invalid", customerId: null, subscriptionId: null });
    expect(intent.createdAtMs).toBe(Date.parse("2026-10-18T14:15:15.000Z"));
    expect(intent.retryNotAfterMs).toBe(intent.createdAtMs + 23 * 3600000);
    expect(intent.canonicalRequest).toBeTypeOf("string");
    expect(intent.requestDigest).toBe(createHash("sha256").update(intent.canonicalRequest!).digest("hex"));
    expect(intent.originalCreateProof?.outboundRequestDigest).toBe(intent.requestDigest);
    expect(Object.isFrozen(intent)).toBe(true);
  });
  it("freezes exact scope and canonical original-attempt identity; extra caller fields confer no provenance", () => {
    const f = prepared();
    expect(createEnrollmentV2({ ...scope, ignored: "x" } as typeof scope)).toEqual(f.enrollment);
    expect(f.enrollment.digest).not.toBe(createEnrollmentV2({ ...scope, accountId: "other" }).digest);
    expect(originalCreateProofDigest({ ...f.intent, originalCreateProof: { ...f.intent.originalCreateProof!, requestId: "other" } })).not.toBe(originalCreateProofDigest(f.intent));
    expect(() => originalCreateProofDigest({ ...f.intent, originalCreateProof: undefined })).toThrow();
  });
  it("derives paid anchor only from matching first full V2 collection and immutable original terms", () => {
    const f = prepared(), basis = paidBasisForOriginalCollection(f.enrollment, f.intent, f.evidence);
    expect(basis).toMatchObject({ kind: "paid", anchor: f.evidence.serviceStart, origin: { intentId: "intent", firstCollectionDigest: f.evidence.digest, createProofDigest: originalCreateProofDigest(f.intent) } });
    for (const changed of [{ ...f.evidence, organizationId: "foreign" }, { ...f.evidence, enrollmentDigest: "0".repeat(64) }, { ...f.evidence, originalAnchor: "2026-09-18T14:15:16.000Z" }, { ...f.evidence, originalCreateProofDigest: "0".repeat(64) }, { ...f.evidence, version: 1 }]) expect(() => paidBasisForOriginalCollection(f.enrollment, f.intent, changed as typeof f.evidence)).toThrow();
    expect(() => paidBasisForOriginalCollection(f.enrollment, { ...f.intent, allowanceV2: undefined }, f.evidence)).toThrow();
  });
  it("distinguishes an uninstalled lane from corrupt/partial installation and wrong scope", async () => {
    const absent = { $queryRawUnsafe: vi.fn(async () => [{ installed: false, partial: false }]) } as unknown as Prisma.TransactionClient;
    expect(await readFixtureEnrollment(absent, scope)).toBeNull();
    const partial = { $queryRawUnsafe: vi.fn(async () => [{ installed: false, partial: true }]) } as unknown as Prisma.TransactionClient;
    await expect(readFixtureEnrollment(partial, scope)).rejects.toThrow();
    const f = prepared(), bad = { $queryRawUnsafe: vi.fn().mockResolvedValueOnce([{ installed: true, partial: false }]).mockResolvedValueOnce([{ body: { ...f.enrollment, accountId: "other" }, revision: 1, free: null, paid: null }]) } as unknown as Prisma.TransactionClient;
    await expect(readFixtureEnrollment(bad, scope)).rejects.toThrow();
  });
  it("declares owned-only immutability, original hold foreign key and scope checks without storing balances", () => {
    const ddl = fixtureAllocationDDL.join("\n");
    expect(ddl).toContain('REFERENCES "AIUsageReservation"(id)');
    expect(ddl).toContain("allowance_basis_immutable"); expect(ddl).toContain("attribution_immutable");
    expect(ddl).not.toMatch(/remainingCents|balanceCents/);
  });
});
