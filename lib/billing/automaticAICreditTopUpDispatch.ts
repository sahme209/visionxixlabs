import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { findAddOn } from "./addOnCatalog";
import { automaticTopUpConsentDigest, verifyAutomaticTopUpSetup, type AutomaticTopUpSetupBinding } from "./automaticAICreditTopUpConsent";
import { publicDatabaseNow, readPublicCreditAllowance } from "./publicCreditAuthority";
import { lockPublicOrganization, readPublicEnrollment, type PublicSql, type PublicSqlRepository } from "./publicBillingStore";
import type { PublicBillingIdentity } from "./publicCheckoutService";

export type DispatchScope = { organizationId: string; intentId: string; identity: PublicBillingIdentity };
type Intent = { consentRevision: number; periodMonth: string; sku: string; amountCents: number; state: string };
type CurrentBinding = { binding: AutomaticTopUpSetupBinding; paymentMethodId: string; consentDigest: string; monthlyCeilingCents: number };
type Claim =
  | { kind: "claimed"; providerKey: string; requestJson: string; requestDigest: string; periodMonth: string }
  | { kind: "inactive" | "unavailable" | "stale" | "setup_unverified" };

const serializable = { isolationLevel: "Serializable" } as const;

async function currentBinding(tx: PublicSql, scope: DispatchScope, intent: Intent): Promise<CurrentBinding | null> {
  const [row] = await tx.$queryRawUnsafe<Array<{
    sku: string; amountCents: number; monthlyCeilingCents: number; thresholdCents: number;
    actorUserId: string; setupIntentId: string; customerId: string; paymentMethodId: string;
    consentDigest: string; terms: Omit<AutomaticTopUpSetupBinding, "setupIntentId">;
  }>>(`
    SELECT c.sku,c."amountCents",c."monthlyCeilingCents",c."thresholdCents",c."consentedByUserId" AS "actorUserId",
      r."setupIntentId",r."customerId",r."paymentMethodId",r."consentDigest",a.terms
    FROM "AutomaticAICreditTopUpConsent" c
    JOIN "AutomaticAICreditSetupReceipt" r ON r."organizationId"=c."organizationId"
      AND r."setupIntentId"=c."providerConsentRef" AND r."consentRevision"=c.revision
    JOIN "AutomaticAICreditSetupAttempt" a ON a."organizationId"=c."organizationId"
      AND a."setupIntentId"=r."setupIntentId" AND a."consentDigest"=r."consentDigest"
      AND a."actorUserId"=c."consentedByUserId" AND a.state='consumed'
    WHERE c."organizationId"=$1 AND c.revision=$2 AND c.enabled
      AND c."accountId"=$3 AND NOT c.livemode FOR UPDATE OF c
  `, scope.organizationId, intent.consentRevision, scope.identity.accountId);
  const pack = findAddOn(intent.sku);
  if (!row || pack?.category !== "ai_credits" || pack.priceCents !== intent.amountCents
      || row.sku !== intent.sku || row.amountCents !== intent.amountCents) return null;
  const binding = { ...row.terms, setupIntentId: row.setupIntentId };
  if (binding.organizationId !== scope.organizationId || binding.actorUserId !== row.actorUserId
      || binding.identity?.accountId !== scope.identity.accountId || binding.identity.livemode !== false
      || binding.customerId !== row.customerId || (binding.expectedRevision ?? 0) + 1 !== intent.consentRevision
      || binding.thresholdCents !== row.thresholdCents || binding.monthlyCeilingCents !== row.monthlyCeilingCents
      || binding.sku !== row.sku || binding.amountCents !== row.amountCents
      || automaticTopUpConsentDigest(binding) !== row.consentDigest) return null;
  const members = await tx.$queryRawUnsafe<Array<{ role: string }>>(
    'SELECT role FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2 AND "acceptedAt" IS NOT NULL FOR SHARE',
    scope.organizationId, row.actorUserId,
  );
  if (members.length !== 1 || !["owner", "admin"].includes(members[0].role)) return null;
  const customers = await tx.$queryRawUnsafe<Array<{ organizationId: string }>>(
    'SELECT "organizationId" FROM "TenantBillingPlan" WHERE "stripeCustomerId"=$1 FOR SHARE', row.customerId,
  );
  if (customers.length !== 1 || customers[0].organizationId !== scope.organizationId) return null;
  const enrollment = await readPublicEnrollment(tx, scope.organizationId);
  if (!enrollment || enrollment.livemode !== false || enrollment.accountId !== scope.identity.accountId) return null;
  return { binding, paymentMethodId: row.paymentMethodId, consentDigest: row.consentDigest, monthlyCeilingCents: row.monthlyCeilingCents };
}

async function readIntent(tx: PublicSql, scope: DispatchScope) {
  const [intent] = await tx.$queryRawUnsafe<Intent[]>(`
    SELECT "consentRevision","periodMonth",sku,"amountCents",state
    FROM "AutomaticAICreditTopUpIntent" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE
  `, scope.intentId, scope.organizationId);
  return intent;
}

/** Private server input for a fresh Stripe setup retrieve. The lookup does
 * not claim dispatch authority and does not perform provider IO. */
export async function readAutomaticTopUpDispatchBinding(repo: PublicSqlRepository, scope: DispatchScope) {
  if (scope.identity.livemode !== false) return null;
  return repo.$transaction(async tx => {
    await lockPublicOrganization(tx, scope.organizationId);
    const intent = await readIntent(tx, scope);
    if (intent?.state !== "prepared") return null;
    const current = await currentBinding(tx, scope, intent);
    return current?.binding ?? null;
  }, serializable);
}

/** Settling an already-incurred payment remains possible after consent is
 * revoked. Presenting a new authentication challenge requires current consent. */
export async function readAutomaticTopUpRecoveryBinding(
  repo: PublicSqlRepository, scope: DispatchScope & { userId: string },
  mode: "read" | "authenticate" | "claim_retry",
) {
  if (scope.identity.livemode !== false) return null;
  return repo.$transaction(async tx => {
    await lockPublicOrganization(tx, scope.organizationId);
    const intent = await readIntent(tx, scope);
    if (!intent || (mode !== "read" && intent.state !== "authentication_required")) return null;
    const [claim] = await tx.$queryRawUnsafe<Array<{
      paymentIntentId: string; requestJson: string; requestDigest: string; providerStatus: string; onSessionRetryClaimed: boolean;
    }>>(`
      SELECT c."paymentIntentId",c."requestJson",c."requestDigest",c."providerStatus",c."onSessionRetryClaimed"
      FROM "AutomaticAICreditDispatchClaim" c
      JOIN "AutomaticAICreditSetupReceipt" r ON r."organizationId"=c."organizationId" AND r."consentRevision"=$4
      JOIN "AutomaticAICreditSetupAttempt" a ON a."organizationId"=r."organizationId" AND a."setupIntentId"=r."setupIntentId"
        AND a."consentDigest"=r."consentDigest" AND a.state='consumed'
      JOIN "OrgMembership" m ON m."organizationId"=c."organizationId" AND m."userId"=a."actorUserId"
      WHERE c."intentId"=$1 AND c."organizationId"=$2 AND c."accountId"=$3 AND c."paymentIntentId" IS NOT NULL
        AND m."userId"=$5 AND m."acceptedAt" IS NOT NULL AND m.role IN ('owner','admin')
      FOR SHARE OF m
    `, scope.intentId, scope.organizationId, scope.identity.accountId, intent.consentRevision, scope.userId);
    if (!claim || createHash("sha256").update(claim.requestJson).digest("hex") !== claim.requestDigest) return null;
    if (mode !== "read") {
      if (claim.providerStatus !== "requires_action" &&
        (claim.providerStatus !== "requires_payment_method" || claim.onSessionRetryClaimed)) return null;
      const current = await currentBinding(tx, scope, intent);
      const request = JSON.parse(claim.requestJson) as Stripe.PaymentIntentCreateParams;
      if (!current || current.binding.actorUserId !== scope.userId || request.customer !== current.binding.customerId
          || request.payment_method !== current.paymentMethodId || request.amount !== intent.amountCents) return null;
    }
    if (mode === "claim_retry") {
      if (intent.periodMonth !== (await publicDatabaseNow(tx)).toISOString().slice(0, 7)) return null;
      const written = await tx.$executeRawUnsafe(`
        UPDATE "AutomaticAICreditDispatchClaim" SET "onSessionRetryClaimed"=true
        WHERE "intentId"=$1 AND "organizationId"=$2 AND "accountId"=$3 AND "paymentIntentId"=$4
          AND "providerStatus"='requires_payment_method' AND NOT "onSessionRetryClaimed"
      `, scope.intentId, scope.organizationId, scope.identity.accountId, claim.paymentIntentId);
      if (written !== 1) return null;
    }
    return { ...claim, state: intent.state, periodMonth: intent.periodMonth };
  }, serializable);
}

async function cancelPrepared(tx: PublicSql, scope: DispatchScope) {
  await tx.$executeRawUnsafe(`
    UPDATE "AutomaticAICreditTopUpIntent" SET state='canceled'
    WHERE id=$1 AND "organizationId"=$2 AND state='prepared'
  `, scope.intentId, scope.organizationId);
  return { kind: "stale" } as const;
}

/** Single-use test-mode dispatch claim. The caller must supply a fresh
 * server retrieve result, then send only these exact bytes after commit.
 * No provider call or credit write occurs here. A claimed payment remains
 * uncertain until reconciled, even if the eventual sender loses its reply. */
export async function claimAutomaticTopUpDispatch(
  repo: PublicSqlRepository,
  scope: DispatchScope,
  observation: { accountId: string; setup: Stripe.SetupIntent },
): Promise<Claim> {
  if (scope.identity.livemode !== false) return { kind: "unavailable" };
  try {
    return await repo.$transaction(async tx => {
      await lockPublicOrganization(tx, scope.organizationId);
      const intent = await readIntent(tx, scope);
      if (intent?.state !== "prepared") return { kind: "inactive" } as const;

      const current = await currentBinding(tx, scope, intent);
      if (!current) return cancelPrepared(tx, scope);
      const now = await publicDatabaseNow(tx);
      if (intent.periodMonth !== now.toISOString().slice(0, 7)) return cancelPrepared(tx, scope);
      const receipt = verifyAutomaticTopUpSetup(current.binding, observation);
      if (!receipt || receipt.paymentMethodId !== current.paymentMethodId || receipt.consentDigest !== current.consentDigest) {
        return { kind: "setup_unverified" } as const;
      }
      const [paid] = await tx.$queryRawUnsafe<Array<{ amount: string }>>(`
        SELECT COALESCE(sum("amountCents"),0)::text AS amount FROM "AutomaticAICreditTopUpIntent"
        WHERE "organizationId"=$1 AND "periodMonth"=$2 AND state='paid'
      `, scope.organizationId, intent.periodMonth);
      if (BigInt(paid.amount) + BigInt(intent.amountCents) > BigInt(current.monthlyCeilingCents)) return cancelPrepared(tx, scope);
      const balance = await readPublicCreditAllowance(tx, scope.organizationId, scope.identity, now);
      if (!balance?.available) return { kind: "unavailable" } as const;
      if (balance.includedRemainingCents > current.binding.thresholdCents) return cancelPrepared(tx, scope);

      const requestJson = JSON.stringify({
        amount: intent.amountCents, currency: "usd", customer: receipt.customerId, payment_method: receipt.paymentMethodId,
        payment_method_types: ["card"], off_session: true, confirm: true,
        metadata: { purpose: "axiom_auto_ai_credit_top_up_v1", intentId: scope.intentId, organizationId: scope.organizationId, sku: intent.sku },
      } satisfies Stripe.PaymentIntentCreateParams);
      const requestDigest = createHash("sha256").update(requestJson).digest("hex");
      const providerKey = `axiom_auto_top_up_${scope.intentId}`;
      const changed = await tx.$executeRawUnsafe(`
        UPDATE "AutomaticAICreditTopUpIntent" SET state='dispatch_unknown'
        WHERE id=$1 AND "organizationId"=$2 AND state='prepared'
          AND "periodMonth"=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM')
      `, scope.intentId, scope.organizationId);
      if (changed !== 1) return cancelPrepared(tx, scope);
      await tx.$executeRawUnsafe(`
        INSERT INTO "AutomaticAICreditDispatchClaim"
          ("intentId","organizationId","accountId","providerKey","requestJson","requestDigest","claimedAt")
        VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp() AT TIME ZONE 'UTC')
      `, scope.intentId, scope.organizationId, scope.identity.accountId, providerKey, requestJson, requestDigest);
      return { kind: "claimed", providerKey, requestJson, requestDigest, periodMonth: intent.periodMonth } as const;
    }, serializable);
  } catch {
    return { kind: "unavailable" };
  }
}
