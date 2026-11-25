import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { findAddOn } from "./addOnCatalog";
import { aiCreditRefundAmount } from "./aiCreditRefundAmount";
import { automaticTopUpDisputeAdjustment } from "./automaticAICreditTopUpRefund";
import { claimAutomaticTopUpDispatch, readAutomaticTopUpDispatchBinding, readAutomaticTopUpRecoveryBinding, type DispatchScope } from "./automaticAICreditTopUpDispatch";
import { makeAutomaticTopUpSetupProvider } from "./automaticAICreditTopUpSetupProvider";
import { PUBLIC_STRIPE_API_VERSION } from "./publicBillingConfig";
import { lockPublicOrganization, readPublicEnrollment, type PublicSqlRepository } from "./publicBillingStore";

type TestClient = Pick<Stripe, "accounts" | "setupIntents" | "paymentIntents">;
type ScopedIntent = Omit<DispatchScope, "identity">;

const reference = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;
const paymentIntentIdPattern = /^pi_[A-Za-z0-9]+$/;
const serializable = { isolationLevel: "Serializable" } as const;

function verifiedResponse(response: Stripe.Response<unknown>["lastResponse"], accountId: string) {
  return response.apiVersion === PUBLIC_STRIPE_API_VERSION && Boolean(response.requestId)
    && response.statusCode >= 200 && response.statusCode < 300 && (!response.stripeAccount || response.stripeAccount === accountId);
}

function samePayment(
  payment: Stripe.Response<Stripe.PaymentIntent>,
  request: Stripe.PaymentIntentCreateParams,
  accountId: string,
  boundForRecovery = false,
) {
  const method = reference(payment.payment_method);
  const attemptedMethod = payment.status === "requires_payment_method"
    ? reference(payment.last_payment_error?.payment_method ?? null) : undefined;
  const methodMatches = method === request.payment_method
    || (!method && attemptedMethod === request.payment_method && typeof attemptedMethod === "string")
    || (boundForRecovery && !method && payment.status === "canceled");
  return verifiedResponse(payment.lastResponse, accountId)
    && payment.object === "payment_intent" && paymentIntentIdPattern.test(payment.id) && payment.livemode === false
    && payment.amount === request.amount && payment.currency === request.currency
    && reference(payment.customer) === request.customer && methodMatches
    && payment.metadata.purpose === request.metadata?.purpose && payment.metadata.intentId === request.metadata?.intentId
    && payment.metadata.organizationId === request.metadata?.organizationId && payment.metadata.sku === request.metadata?.sku;
}

function cardErrorPaymentIntent(error: unknown) {
  if (!error || typeof error !== "object" || !("type" in error) || error.type !== "StripeCardError"
      || !("statusCode" in error) || error.statusCode !== 402 || !("payment_intent" in error)) return null;
  const payment = error.payment_intent;
  return payment && typeof payment === "object" && "id" in payment && typeof payment.id === "string"
    && paymentIntentIdPattern.test(payment.id) ? payment.id : null;
}

/** Internal rehearsal only. The caller must supply an approved test-key
 * client with a bounded timeout and no SDK retries. There is no hosted
 * caller, scheduler, or credit fulfillment attached to this service. */
export function makeAutomaticTopUpTestDispatcher(
  repo: PublicSqlRepository,
  client: TestClient,
  identity: DispatchScope["identity"],
) {
  const setup = makeAutomaticTopUpSetupProvider(client, identity);
  const reconcile = makeAutomaticTopUpTestReconciler(repo, client, identity);
  return async function dispatch(input: ScopedIntent) {
    const scope = { ...input, identity };
    try {
      const binding = await readAutomaticTopUpDispatchBinding(repo, scope);
      if (!binding) return { kind: "inactive" } as const;
      const observation = await setup.retrieve(binding);
      const claimed = await claimAutomaticTopUpDispatch(repo, scope, observation);
      if (claimed.kind !== "claimed") return claimed;
      // Check again after commit. A process that crossed UTC rollover must
      // preserve the unknown claim for reconciliation without sending.
      if (new Date().toISOString().slice(0, 7) !== claimed.periodMonth
          || createHash("sha256").update(claimed.requestJson).digest("hex") !== claimed.requestDigest) {
        return { kind: "dispatch_unknown" } as const;
      }
      const request = JSON.parse(claimed.requestJson) as Stripe.PaymentIntentCreateParams;
      try {
        const payment = await client.paymentIntents.create(request, {
          idempotencyKey: claimed.providerKey, maxNetworkRetries: 0,
        });
        if (!samePayment(payment, request, identity.accountId)) return { kind: "dispatch_unknown" } as const;
        if (payment.status !== "succeeded") return reconcile(input, payment.id);
        const written = await repo.$transaction(async tx => {
          await lockPublicOrganization(tx, scope.organizationId);
          return tx.$executeRawUnsafe(`
            UPDATE "AutomaticAICreditDispatchClaim"
            SET "paymentIntentId"=$1,"providerStatus"=$2,"observedAt"=clock_timestamp() AT TIME ZONE 'UTC'
            WHERE "intentId"=$3 AND "organizationId"=$4 AND "accountId"=$5 AND "requestDigest"=$6
              AND "paymentIntentId" IS NULL
          `, payment.id, payment.status, scope.intentId, scope.organizationId, identity.accountId, claimed.requestDigest);
        }, serializable);
        return written === 1 ? { kind: "provider_observed" } as const : { kind: "dispatch_unknown" } as const;
      } catch (error) {
        // A provider error or interrupted acknowledgement is not proof of
        // nonpayment. The persisted claim fences any second create.
        const candidateId = cardErrorPaymentIntent(error);
        if (candidateId) return reconcile(input, candidateId);
        return { kind: "dispatch_unknown" } as const;
      }
    } catch {
      return { kind: "unavailable" } as const;
    }
  };
}

type PaymentObservation = {
  requestJson: string;
  requestDigest: string;
  paymentIntentId: string | null;
  providerStatus: Stripe.PaymentIntent.Status | null;
  observedAt: string | null;
};

const observableStatuses: ReadonlySet<Stripe.PaymentIntent.Status> = new Set([
  "requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture", "canceled", "succeeded",
]);
const recoverableStates = "('dispatch_unknown','authentication_required','payment_failed')";

function paymentRecoveryState(payment: Stripe.PaymentIntent) {
  if (payment.status === "canceled") return "canceled";
  if (payment.status === "requires_action") return "authentication_required";
  if (payment.status === "requires_payment_method") {
    const error = payment.last_payment_error;
    return error?.decline_code === "authentication_required" || error?.code === "authentication_required"
      ? "authentication_required" : "payment_failed";
  }
  return "dispatch_unknown";
}

/** Test-mode reconciliation reads an already submitted payment. An internal
 * caller may supply a candidate ID from trusted provider evidence if the
 * create response was lost. Stripe must independently confirm the binding.
 * An observation does not settle the prepaid ledger. */
export function makeAutomaticTopUpTestReconciler(
  repo: PublicSqlRepository,
  client: Pick<Stripe, "accounts" | "paymentIntents">,
  identity: DispatchScope["identity"],
) {
  return async function reconcile(input: ScopedIntent, candidateId?: string) {
    if (identity.livemode !== false) return { kind: "unavailable" } as const;
    try {
      const [claim] = await repo.$transaction(tx => tx.$queryRawUnsafe<PaymentObservation[]>(`
        SELECT c."requestJson",c."requestDigest",c."paymentIntentId",c."providerStatus",c."observedAt"::text AS "observedAt"
        FROM "AutomaticAICreditDispatchClaim" c
        JOIN "AutomaticAICreditTopUpIntent" i ON i.id=c."intentId" AND i."organizationId"=c."organizationId"
        WHERE c."intentId"=$1 AND c."organizationId"=$2 AND c."accountId"=$3 AND i.state IN ${recoverableStates}
      `, input.intentId, input.organizationId, identity.accountId), serializable);
      if (!claim) return { kind: "inactive" } as const;
      const paymentId = claim.paymentIntentId ?? candidateId;
      if (!paymentId) return { kind: "dispatch_unknown" } as const;
      if (!paymentIntentIdPattern.test(paymentId) || (candidateId !== undefined && candidateId !== paymentId)
          || createHash("sha256").update(claim.requestJson).digest("hex") !== claim.requestDigest) {
        return { kind: "observation_unverified" } as const;
      }

      const account = await client.accounts.retrieve({}, { maxNetworkRetries: 0 });
      if (account.id !== identity.accountId || !verifiedResponse(account.lastResponse, identity.accountId)) {
        return { kind: "observation_unverified" } as const;
      }
      const request = JSON.parse(claim.requestJson) as Stripe.PaymentIntentCreateParams;
      const payment = await client.paymentIntents.retrieve(paymentId, {}, { maxNetworkRetries: 0 });
      const terminal = claim.providerStatus === "succeeded" || claim.providerStatus === "canceled";
      if (payment.id !== paymentId || !samePayment(payment, request, identity.accountId, claim.paymentIntentId === paymentId) || !observableStatuses.has(payment.status)
          || (terminal && payment.status !== claim.providerStatus)
          || (payment.status === "canceled" && (payment.amount_received !== 0 || payment.amount_capturable !== 0))
          || (payment.status === "succeeded" && payment.amount_received !== request.amount)) {
        return { kind: "observation_unverified" } as const;
      }

      const written = await repo.$transaction(async tx => {
        await lockPublicOrganization(tx, input.organizationId);
        return tx.$executeRawUnsafe(`
          WITH observed AS (
            UPDATE "AutomaticAICreditDispatchClaim" c
            SET "paymentIntentId"=$1,"providerStatus"=$2,"observedAt"=clock_timestamp() AT TIME ZONE 'UTC'
            FROM "AutomaticAICreditTopUpIntent" i
            WHERE i.id=c."intentId" AND i."organizationId"=c."organizationId" AND i.state IN ${recoverableStates}
              AND c."intentId"=$3 AND c."organizationId"=$4 AND c."accountId"=$5 AND c."requestDigest"=$6
              AND c."paymentIntentId" IS NOT DISTINCT FROM $7 AND c."providerStatus" IS NOT DISTINCT FROM $8
              AND c."observedAt" IS NOT DISTINCT FROM $9::timestamp
            RETURNING c."intentId",c."organizationId"
          )
          UPDATE "AutomaticAICreditTopUpIntent" i SET state=$10 FROM observed
          WHERE i.id=observed."intentId" AND i."organizationId"=observed."organizationId"
        `, payment.id, payment.status, input.intentId, input.organizationId, identity.accountId, claim.requestDigest,
        claim.paymentIntentId, claim.providerStatus, claim.observedAt, paymentRecoveryState(payment));
      }, serializable);
      return written === 1 ? { kind: "provider_observed", status: payment.status } as const : { kind: "dispatch_unknown" } as const;
    } catch {
      return { kind: "unavailable" } as const;
    }
  };
}

type SettlementBinding = {
  state: string;
  paymentIntentId: string;
  requestJson: string;
  requestDigest: string;
};

/** Internal test-only settlement. A fresh read of the PaymentIntent and its
 * captured charge is required even when the original receipt said succeeded. */
export function makeAutomaticTopUpTestSettlement(
  repo: PublicSqlRepository,
  client: Pick<Stripe, "accounts" | "paymentIntents" | "charges">,
  identity: DispatchScope["identity"],
) {
  return async function settle({ organizationId, intentId }: ScopedIntent) {
    if (identity.livemode !== false) return { kind: "unavailable" } as const;
    try {
      const [binding] = await repo.$transaction(tx => tx.$queryRawUnsafe<SettlementBinding[]>(`
        SELECT i.state,c."paymentIntentId",c."requestJson",c."requestDigest"
        FROM "AutomaticAICreditDispatchClaim" c
        JOIN "AutomaticAICreditTopUpIntent" i ON i.id=c."intentId" AND i."organizationId"=c."organizationId"
        WHERE c."intentId"=$1 AND c."organizationId"=$2 AND c."accountId"=$3 AND c."providerStatus"='succeeded'
          AND i.state IN ('dispatch_unknown','paid')
      `, intentId, organizationId, identity.accountId), serializable);
      if (!binding) return { kind: "inactive" } as const;
      if (binding.state === "paid") return { kind: "already_settled" } as const;
      if (!paymentIntentIdPattern.test(binding.paymentIntentId)
          || createHash("sha256").update(binding.requestJson).digest("hex") !== binding.requestDigest) {
        return { kind: "payment_unverified" } as const;
      }
      const request = JSON.parse(binding.requestJson) as Stripe.PaymentIntentCreateParams;
      const sku = request.metadata?.sku;
      const pack = typeof sku === "string" ? findAddOn(sku) : null;
      if (pack?.category !== "ai_credits" || pack.priceCents !== request.amount
          || request.currency !== "usd" || request.metadata?.purpose !== "axiom_auto_ai_credit_top_up_v1"
          || request.metadata.intentId !== intentId || request.metadata.organizationId !== organizationId) {
        return { kind: "payment_unverified" } as const;
      }

      const account = await client.accounts.retrieve({}, { maxNetworkRetries: 0 });
      if (account.id !== identity.accountId || !verifiedResponse(account.lastResponse, identity.accountId)) {
        return { kind: "payment_unverified" } as const;
      }
      const payment = await client.paymentIntents.retrieve(binding.paymentIntentId, {}, { maxNetworkRetries: 0 });
      const chargeId = reference(payment.latest_charge);
      if (payment.id !== binding.paymentIntentId || !samePayment(payment, request, identity.accountId)
          || payment.status !== "succeeded" || payment.amount_received !== request.amount
          || !chargeId || !/^ch_[A-Za-z0-9]+$/.test(chargeId)) {
        return { kind: "payment_unverified" } as const;
      }
      const charge = await client.charges.retrieve(chargeId, {}, { maxNetworkRetries: 0 });
      if (!verifiedResponse(charge.lastResponse, identity.accountId)
          || charge.object !== "charge" || charge.id !== chargeId || charge.livemode !== false
          || charge.status !== "succeeded" || charge.paid !== true || charge.captured !== true
          || typeof charge.disputed !== "boolean" || !Number.isSafeInteger(charge.amount_refunded)
          || charge.amount_refunded < 0 || charge.amount_refunded > pack.priceCents
          || charge.refunded !== (charge.amount_refunded === pack.priceCents)
          || charge.amount !== request.amount || charge.amount_captured !== request.amount || charge.currency !== request.currency
          || reference(charge.payment_intent) !== payment.id || reference(charge.customer) !== request.customer
          || charge.payment_method !== request.payment_method) {
        return { kind: "payment_unverified" } as const;
      }

      return await repo.$transaction(async tx => {
        await lockPublicOrganization(tx, organizationId);
        const [purchase] = await tx.$queryRawUnsafe<Array<{
          state: string; periodMonth: string; actorUserId: string; providerKey: string;
          refundChargeId: string | null; refundedAmountCents: number;
        }>>(`
          SELECT i.state,i."periodMonth",a."actorUserId",c."providerKey",c."refundChargeId",c."refundedAmountCents"
          FROM "AutomaticAICreditTopUpIntent" i
          JOIN "AutomaticAICreditDispatchClaim" c ON c."intentId"=i.id AND c."organizationId"=i."organizationId"
          JOIN "AutomaticAICreditSetupReceipt" r ON r."organizationId"=i."organizationId" AND r."consentRevision"=i."consentRevision"
          JOIN "AutomaticAICreditSetupAttempt" a ON a."organizationId"=r."organizationId" AND a."setupIntentId"=r."setupIntentId"
            AND a."consentDigest"=r."consentDigest" AND a.state='consumed'
          WHERE i.id=$1 AND i."organizationId"=$2 AND c."accountId"=$3 AND c."requestDigest"=$4
            AND c."paymentIntentId"=$5 AND c."providerStatus"='succeeded'
            AND i.sku=$6 AND i."amountCents"=$7 AND r."customerId"=$8 AND r."paymentMethodId"=$9
          FOR UPDATE OF i,c
        `, intentId, organizationId, identity.accountId, binding.requestDigest, payment.id,
        pack.sku, pack.priceCents, request.customer, request.payment_method);
        if (purchase?.state === "paid") return { kind: "already_settled" } as const;
        if (purchase?.state !== "dispatch_unknown") return { kind: "inactive" } as const;
        if (purchase.refundChargeId && purchase.refundChargeId !== charge.id) return { kind: "payment_unverified" } as const;
        const dispute = await automaticTopUpDisputeAdjustment(tx, intentId, charge.id, pack.priceCents);
        if (charge.disputed && !dispute.bound) return { kind: "payment_unverified" } as const;
        const enrollment = await readPublicEnrollment(tx, organizationId);
        if (!enrollment || enrollment.livemode !== false || enrollment.accountId !== identity.accountId) {
          return { kind: "unavailable" } as const;
        }
        const adjustment = aiCreditRefundAmount(
          Math.max(charge.amount_refunded, purchase.refundedAmountCents), pack.priceCents, pack.deliveredAICreditsCents,
        );
        const combined = aiCreditRefundAmount(adjustment.refundedAmountCents + dispute.unavailableCents,
          pack.priceCents, pack.deliveredAICreditsCents);
        // Both writes commit or roll back together. A unique provider payment
        // ID also prevents any other ledger path from crediting this payment.
        await tx.$executeRawUnsafe(`
          INSERT INTO "AddOnPurchase" (id,"organizationId",sku,"pricePaidCents","deliveredAICreditsCents",
            "validFor","periodMonth",status,"stripePaymentIntentId","idempotencyKey","purchasedBy","correlationId",
            "appliedAt","createdAt","updatedAt","refundedAmountCents","reversedAICreditsCents","refundedAt")
          SELECT $1,$2,$3,$4,$5,$6,$7,$11,$8,$1,$9,$10,stamp,stamp,stamp,$12,$13,CASE WHEN $11='refunded' THEN stamp END
          FROM (SELECT clock_timestamp() AT TIME ZONE 'UTC' AS stamp) AS now
        `, purchase.providerKey, organizationId, pack.sku, pack.priceCents, pack.deliveredAICreditsCents,
        pack.validFor, purchase.periodMonth, payment.id, purchase.actorUserId, intentId,
        adjustment.status, adjustment.refundedAmountCents, combined.reversedAICreditsCents);
        const changed = await tx.$executeRawUnsafe(`
          UPDATE "AutomaticAICreditTopUpIntent" SET state='paid'
          WHERE id=$1 AND "organizationId"=$2 AND state='dispatch_unknown'
        `, intentId, organizationId);
        if (changed !== 1) throw new Error("automatic_top_up_settlement_conflict");
        return { kind: "settled" } as const;
      }, serializable);
    } catch {
      return { kind: "unavailable" } as const;
    }
  };
}

/** A signed notification only locates the payment. Commit prepaid credit
 * after the independent charge verification, even if no manager is online. */
export function makeAutomaticTopUpTestPaymentNotification(
  repo: PublicSqlRepository,
  client: Pick<Stripe, "accounts" | "paymentIntents" | "charges">,
  identity: DispatchScope["identity"],
) {
  const reconcile = makeAutomaticTopUpTestReconciler(repo, client, identity);
  const settle = makeAutomaticTopUpTestSettlement(repo, client, identity);
  return async (scope: ScopedIntent, paymentId: string, expectSucceeded: boolean) => {
    const observed = await reconcile(scope, paymentId);
    if (observed.kind === "inactive") return observed;
    if (observed.kind !== "provider_observed") return { kind: "retry" } as const;
    if (observed.status !== "succeeded") {
      return expectSucceeded ? { kind: "retry" } as const : observed;
    }
    const result = await settle(scope);
    return result.kind === "settled" || result.kind === "already_settled"
      ? result : { kind: "retry" } as const;
  };
}

export function makeAutomaticTopUpTestRecovery(
  repo: PublicSqlRepository,
  client: Pick<Stripe, "accounts" | "paymentIntents" | "charges">,
  identity: DispatchScope["identity"],
) {
  type ActorIntent = ScopedIntent & { userId: string };
  const reconcile = makeAutomaticTopUpTestReconciler(repo, client, identity);
  const settle = makeAutomaticTopUpTestSettlement(repo, client, identity);
  async function verify(input: ActorIntent) {
    const claim = await readAutomaticTopUpRecoveryBinding(repo, { ...input, identity }, "read");
    if (!claim) return { kind: "unavailable" } as const;
    if (claim.state === "canceled" && claim.providerStatus === "canceled") return { kind: "canceled" } as const;
    const observation = await reconcile(input, claim.paymentIntentId);
    if (observation.kind === "provider_observed" && observation.status === "canceled") return { kind: "canceled" } as const;
    if (observation.kind === "inactive" || (observation.kind === "provider_observed" && observation.status === "succeeded")) {
      const result = await settle(input);
      if (result.kind === "settled" || result.kind === "already_settled") return { kind: "verified" } as const;
    }
    return { kind: "pending" } as const;
  }
  return {
    async authenticate(input: ActorIntent) {
      const scope = { ...input, identity };
      const claim = await readAutomaticTopUpRecoveryBinding(repo, scope, "authenticate");
      if (!claim) return { kind: "unavailable" } as const;
      const account = await client.accounts.retrieve({}, { maxNetworkRetries: 0 });
      if (account.id !== identity.accountId || !verifiedResponse(account.lastResponse, identity.accountId)) {
        return { kind: "unavailable" } as const;
      }
      let payment = await client.paymentIntents.retrieve(claim.paymentIntentId, {}, { maxNetworkRetries: 0 });
      const request = JSON.parse(claim.requestJson) as Stripe.PaymentIntentCreateParams;
      if (payment.id !== claim.paymentIntentId || !samePayment(payment, request, identity.accountId)
          || payment.confirmation_method !== "automatic") return { kind: "unavailable" } as const;
      if (payment.status === "requires_payment_method") {
        if (paymentRecoveryState(payment) !== "authentication_required" || payment.amount_received !== 0
            || payment.amount_capturable !== 0 || typeof request.payment_method !== "string") {
          return { kind: "unavailable" } as const;
        }
        const armed = await readAutomaticTopUpRecoveryBinding(repo, scope, "claim_retry");
        if (armed?.paymentIntentId !== claim.paymentIntentId || armed.requestDigest !== claim.requestDigest
            || armed.periodMonth !== new Date().toISOString().slice(0, 7)) {
          return { kind: "unavailable" } as const;
        }
        try {
          await client.paymentIntents.confirm(claim.paymentIntentId, {
            payment_method: request.payment_method, use_stripe_sdk: true, off_session: false,
          }, { idempotencyKey: `axiom_auto_top_up_on_session_${input.intentId}`, maxNetworkRetries: 0 });
        } catch {
          // The one-use claim remains consumed when the provider result is unknown.
        }
        const observed = await reconcile(input, claim.paymentIntentId);
        if (observed.kind !== "provider_observed" || observed.status !== "requires_action") return verify(input);
        payment = await client.paymentIntents.retrieve(claim.paymentIntentId, {}, { maxNetworkRetries: 0 });
      }
      if (payment.id !== claim.paymentIntentId || !samePayment(payment, request, identity.accountId)
          || payment.status !== "requires_action" || payment.confirmation_method !== "automatic"
          || payment.next_action?.type !== "use_stripe_sdk" || !payment.client_secret
          || !payment.client_secret.startsWith(`${payment.id}_secret_`)
          || !/^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9_]+$/.test(payment.client_secret)) {
        return { kind: "unavailable" } as const;
      }
      const current = await readAutomaticTopUpRecoveryBinding(repo, scope, "authenticate");
      if (current?.paymentIntentId !== claim.paymentIntentId || current.requestDigest !== claim.requestDigest) {
        return { kind: "unavailable" } as const;
      }
      return { kind: "authentication_ready", clientSecret: payment.client_secret } as const;
    },
    async cancel(input: ActorIntent) {
      const scope = { ...input, identity };
      const claim = await readAutomaticTopUpRecoveryBinding(repo, scope, "read");
      if (!claim) return { kind: "unavailable" } as const;
      if (claim.state === "canceled" && claim.providerStatus === "canceled") return { kind: "canceled" } as const;
      if (claim.state !== "payment_failed" && claim.state !== "authentication_required") return verify(input);
      const account = await client.accounts.retrieve({}, { maxNetworkRetries: 0 });
      if (account.id !== identity.accountId || !verifiedResponse(account.lastResponse, identity.accountId)) {
        return { kind: "unavailable" } as const;
      }
      const payment = await client.paymentIntents.retrieve(claim.paymentIntentId, {}, { maxNetworkRetries: 0 });
      const request = JSON.parse(claim.requestJson) as Stripe.PaymentIntentCreateParams;
      if (payment.id !== claim.paymentIntentId || !samePayment(payment, request, identity.accountId, true)) {
        return { kind: "unavailable" } as const;
      }
      if (payment.amount_received !== 0 || payment.amount_capturable !== 0
          || (payment.status !== "requires_action" && payment.status !== "requires_payment_method")) return verify(input);
      const current = await readAutomaticTopUpRecoveryBinding(repo, scope, "read");
      if (current?.paymentIntentId !== claim.paymentIntentId || current.requestDigest !== claim.requestDigest
          || current.state !== claim.state || current.providerStatus !== claim.providerStatus) return { kind: "pending" } as const;
      try {
        await client.paymentIntents.cancel(claim.paymentIntentId, { cancellation_reason: "requested_by_customer" }, {
          idempotencyKey: `axiom_auto_top_up_cancel_${input.intentId}`, maxNetworkRetries: 0,
        });
      } catch {
        // A missing cancellation response does not release the payment hold.
      }
      return verify(input);
    },
    verify,
  };
}
