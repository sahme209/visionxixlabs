import "server-only";

import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { Prisma } from "@/lib/prismaClient";
import { recordRequiredAudit } from "@/lib/audit/requiredAudit";
import { id, type CorrelationId } from "@/lib/domain/ids";
import { lockPublicOrganization, readPublicEnrollment } from "./publicBillingStore";
import { automaticTopUpConsentDigest, matchesAutomaticTopUpProviderSetup, verifyAutomaticTopUpSetup, type AutomaticTopUpSetupBinding, type AutomaticTopUpSetupTerms } from "./automaticAICreditTopUpConsent";
import { findAddOn } from "./addOnCatalog";
import type { PublicBillingIdentity } from "./publicCheckoutService";

type Transaction = Pick<Prisma.TransactionClient, "$queryRawUnsafe" | "$executeRawUnsafe" | "secureAuditRecord">;

async function isBillingManager(tx: Transaction, organizationId: string, userId: string) {
  const rows = await tx.$queryRawUnsafe<Array<{ role: string }>>(
    'SELECT role FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2 AND "acceptedAt" IS NOT NULL FOR SHARE',
    organizationId, userId,
  );
  return rows.length === 1 && (rows[0].role === "owner" || rows[0].role === "admin");
}

async function currentConsent(tx: Transaction, organizationId: string) {
  const [current] = await tx.$queryRawUnsafe<Array<{ revision: number; enabled: boolean }>>(
    'SELECT revision,enabled FROM "AutomaticAICreditTopUpConsent" WHERE "organizationId"=$1 FOR UPDATE', organizationId,
  );
  return current;
}

type SetupActor = { organizationId: string; userId: string };
/** Billing managers receive only public settings and a resumable attempt marker.
 * Transaction read contains no Stripe identifiers or client secrets. */
export async function readAutomaticTopUpSetupStatus(tx: Transaction, actor: SetupActor, identity: PublicBillingIdentity) {
  const { organizationId, userId } = actor;
  await lockPublicOrganization(tx, organizationId);
  if (!await isBillingManager(tx, organizationId, userId)) return { kind: "forbidden" } as const;
  const [consent] = await tx.$queryRawUnsafe<Array<{
    revision: number; enabled: boolean; thresholdCents: number; sku: string; amountCents: number; monthlyCeilingCents: number;
  }>>(`
    SELECT revision,enabled,"thresholdCents",sku,"amountCents","monthlyCeilingCents"
    FROM "AutomaticAICreditTopUpConsent" WHERE "organizationId"=$1
  `, organizationId);
  const [attempt] = await tx.$queryRawUnsafe<Array<{
    id: string; actorUserId: string; bound: boolean; createClaimed: boolean;
  }>>(`
    SELECT id,"actorUserId","setupIntentId" IS NOT NULL AS bound,"createClaimed"
    FROM "AutomaticAICreditSetupAttempt" WHERE "organizationId"=$1 AND state='pending'
  `, organizationId);
  const [payment] = identity.livemode === false ? await tx.$queryRawUnsafe<Array<{
    state: "dispatch_unknown" | "authentication_required" | "payment_failed"; amountCents: number;
    intentId: string | null; authenticationAvailable: boolean; cancellationAvailable: boolean;
  }>>(`
    SELECT i.state,i."amountCents",
      CASE WHEN a."actorUserId"=$3 AND c."paymentIntentId" IS NOT NULL THEN i.id END AS "intentId",
      COALESCE(a."actorUserId"=$3 AND i.state='authentication_required' AND cs.enabled AND cs.revision=i."consentRevision"
        AND (c."providerStatus"='requires_action' OR (c."providerStatus"='requires_payment_method' AND NOT c."onSessionRetryClaimed"
          AND i."periodMonth"=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM'))),false)
        AS "authenticationAvailable",
      COALESCE(a."actorUserId"=$3 AND i.state IN ('payment_failed','authentication_required')
        AND c."providerStatus" IN ('requires_action','requires_payment_method'),false) AS "cancellationAvailable"
    FROM "AutomaticAICreditTopUpIntent" i
    JOIN "AutomaticAICreditDispatchClaim" c ON c."intentId"=i.id AND c."organizationId"=i."organizationId"
    LEFT JOIN "AutomaticAICreditTopUpConsent" cs ON cs."organizationId"=i."organizationId"
    JOIN "AutomaticAICreditSetupReceipt" r ON r."organizationId"=i."organizationId" AND r."consentRevision"=i."consentRevision"
    JOIN "AutomaticAICreditSetupAttempt" a ON a."organizationId"=r."organizationId" AND a."setupIntentId"=r."setupIntentId"
      AND a."consentDigest"=r."consentDigest" AND a.state='consumed'
    WHERE i."organizationId"=$1 AND c."accountId"=$2
      AND i.state IN ('dispatch_unknown','authentication_required','payment_failed')
  `, organizationId, identity.accountId, userId) : [];
  return {
    kind: "ok",
    data: {
      organizationId, consent: consent ?? null,
      payment: payment ?? null,
      pending: attempt ? {
        attemptId: attempt.actorUserId === userId ? attempt.id : null,
        state: attempt.bound ? "payment_setup_pending" : attempt.createClaimed ? "create_unconfirmed" : "registered",
      } : null,
    },
  } as const;
}

type PendingSetup = { terms: AutomaticTopUpSetupTerms; consentDigest: string; setupIntentId: string | null; createClaimed: boolean };

async function pendingSetup(tx: Transaction, actor: SetupActor, attemptId: string) {
  const [row] = await tx.$queryRawUnsafe<PendingSetup[]>(`
    SELECT terms,"consentDigest","setupIntentId","createClaimed" FROM "AutomaticAICreditSetupAttempt"
    WHERE id=$1 AND "organizationId"=$2 AND "actorUserId"=$3 AND state='pending' FOR UPDATE
  `, attemptId, actor.organizationId, actor.userId);
  if (!row || row.terms.attemptId !== attemptId || row.terms.organizationId !== actor.organizationId
      || row.terms.actorUserId !== actor.userId || automaticTopUpConsentDigest(row.terms) !== row.consentDigest) return null;
  return row;
}

async function ownsCustomer(tx: Transaction, organizationId: string, customerId: string, identity: PublicBillingIdentity) {
  const enrollment = await readPublicEnrollment(tx, organizationId);
  if (!enrollment || enrollment.livemode !== false || enrollment.accountId !== identity.accountId) return false;
  const owners = await tx.$queryRawUnsafe<Array<{ organizationId: string }>>(
    'SELECT "organizationId" FROM "TenantBillingPlan" WHERE "stripeCustomerId"=$1 FOR SHARE', customerId,
  );
  return owners.length === 1 && owners[0].organizationId === organizationId;
}

/** Called by the authenticated setup flow inside one serializable transaction. */
export async function registerAutomaticTopUpSetup(
  tx: Transaction,
  actor: SetupActor,
  identity: PublicBillingIdentity,
  input: { accepted: boolean; expectedRevision: number | null; thresholdCents: number; sku: string; monthlyCeilingCents: number },
) {
  const pack = findAddOn(input.sku);
  if (input.accepted !== true || identity.livemode !== false || !/^acct_[A-Za-z0-9]+$/.test(identity.accountId)
      || pack?.category !== "ai_credits" || !Number.isInteger(input.thresholdCents) || input.thresholdCents < 0
      || input.thresholdCents > 2_147_483_647 || !Number.isInteger(input.monthlyCeilingCents)
      || input.monthlyCeilingCents < pack.priceCents || input.monthlyCeilingCents > 2_147_483_647) {
    return { kind: "invalid_terms" } as const;
  }
  const { organizationId, userId } = actor;
  await lockPublicOrganization(tx, organizationId);
  if (!await isBillingManager(tx, organizationId, userId)) return { kind: "forbidden" } as const;
  const [plan] = await tx.$queryRawUnsafe<Array<{ stripeCustomerId: string | null }>>(
    'SELECT "stripeCustomerId" FROM "TenantBillingPlan" WHERE "organizationId"=$1 FOR SHARE', organizationId,
  );
  const customerId = plan?.stripeCustomerId;
  if (!customerId || !/^cus_[A-Za-z0-9]+$/.test(customerId) || !await ownsCustomer(tx, organizationId, customerId, identity)) {
    return { kind: "invalid_customer" } as const;
  }
  const current = await currentConsent(tx, organizationId);
  if ((current?.revision ?? null) !== input.expectedRevision) return { kind: "conflict" } as const;
  const [existing] = await tx.$queryRawUnsafe<Array<{ id: string; actorUserId: string }>>(
    `SELECT id,"actorUserId" FROM "AutomaticAICreditSetupAttempt" WHERE "organizationId"=$1 AND state='pending'`, organizationId,
  );
  if (existing) return { kind: "setup_pending", attemptId: existing.actorUserId === userId ? existing.id : null } as const;
  const terms: AutomaticTopUpSetupTerms = {
    attemptId: randomUUID(), organizationId, actorUserId: userId, customerId, identity,
    expectedRevision: input.expectedRevision, thresholdCents: input.thresholdCents, sku: pack.sku,
    amountCents: pack.priceCents, monthlyCeilingCents: input.monthlyCeilingCents,
  };
  await tx.$executeRawUnsafe(`
    INSERT INTO "AutomaticAICreditSetupAttempt" (id,"organizationId","actorUserId",terms,"consentDigest",state,"createdAt")
    VALUES ($1,$2,$3,$4::jsonb,$5,'pending',clock_timestamp() AT TIME ZONE 'UTC')
  `, terms.attemptId, organizationId, userId, JSON.stringify(terms), automaticTopUpConsentDigest(terms));
  return { kind: "registered", terms } as const;
}

/** Re-read before creating or retrieving a SetupIntent. */
export async function readAutomaticTopUpSetup(tx: Transaction, actor: SetupActor, attemptId: string) {
  await lockPublicOrganization(tx, actor.organizationId);
  if (!await isBillingManager(tx, actor.organizationId, actor.userId)) return null;
  const attempt = await pendingSetup(tx, actor, attemptId);
  if (!attempt || !await ownsCustomer(tx, actor.organizationId, attempt.terms.customerId, attempt.terms.identity)) return null;
  const current = await currentConsent(tx, actor.organizationId);
  return (current?.revision ?? null) === attempt.terms.expectedRevision ? attempt : null;
}

/** Commit before any create call. A lost create response requires review or
 * cancellation. The same attempt never starts another provider create. */
export async function claimAutomaticTopUpSetupCreate(tx: Transaction, actor: SetupActor, attemptId: string) {
  const attempt = await readAutomaticTopUpSetup(tx, actor, attemptId);
  if (!attempt || attempt.createClaimed) return null;
  await tx.$executeRawUnsafe('UPDATE "AutomaticAICreditSetupAttempt" SET "createClaimed"=true WHERE id=$1', attemptId);
  return attempt.terms;
}

export async function bindAutomaticTopUpSetup(
  tx: Transaction, actor: SetupActor, attemptId: string, observation: { accountId: string; setup: Stripe.SetupIntent },
) {
  const attempt = await readAutomaticTopUpSetup(tx, actor, attemptId);
  if (!attempt?.createClaimed || observation.accountId !== attempt.terms.identity.accountId
      || !matchesAutomaticTopUpProviderSetup(attempt.terms, observation.setup)
      || (attempt.setupIntentId && attempt.setupIntentId !== observation.setup.id)) return null;
  await tx.$executeRawUnsafe(
    'UPDATE "AutomaticAICreditSetupAttempt" SET "setupIntentId"=$2 WHERE id=$1', attemptId, observation.setup.id,
  );
  return { ...attempt.terms, setupIntentId: observation.setup.id };
}

/** Internal test-mode finalizer. Call in one serializable transaction.
 * The authenticated setup path must supply its stored binding and a fresh
 * server-side provider observation. There's no direct endpoint for this write. */
export async function saveVerifiedAutomaticTopUpConsent(
  tx: Transaction,
  binding: AutomaticTopUpSetupBinding,
  observation: { accountId: string; setup: Stripe.SetupIntent },
  correlationId: CorrelationId,
) {
  const receipt = verifyAutomaticTopUpSetup(binding, observation);
  if (!receipt) return { kind: "invalid_setup" } as const;
  const { organizationId, actorUserId, identity } = binding;
  await lockPublicOrganization(tx, organizationId);
  if (!await isBillingManager(tx, organizationId, actorUserId)) return { kind: "forbidden" } as const;
  if (!await ownsCustomer(tx, organizationId, receipt.customerId, identity)) return { kind: "invalid_customer" } as const;
  const current = await currentConsent(tx, organizationId);
  if ((current?.revision ?? null) !== binding.expectedRevision) return { kind: "conflict" } as const;
  const attempt = await pendingSetup(tx, { organizationId, userId: actorUserId }, binding.attemptId);
  if (!attempt || attempt.setupIntentId !== receipt.setupIntentId || attempt.consentDigest !== receipt.consentDigest) {
    return { kind: "setup_inactive" } as const;
  }
  const revision = (current?.revision ?? 0) + 1;
  const inserted = await tx.$executeRawUnsafe(`
    INSERT INTO "AutomaticAICreditSetupReceipt"
      ("setupIntentId","organizationId","consentRevision","customerId","paymentMethodId","consentDigest","verifiedAt")
    VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp() AT TIME ZONE 'UTC')
    ON CONFLICT ("setupIntentId") DO NOTHING
  `, receipt.setupIntentId, organizationId, revision, receipt.customerId, receipt.paymentMethodId, receipt.consentDigest);
  if (inserted !== 1) return { kind: "setup_already_used" } as const;

  await tx.$executeRawUnsafe(`
    INSERT INTO "AutomaticAICreditTopUpConsent"
      ("organizationId",revision,enabled,"consentedByUserId","providerConsentRef","accountId",livemode,"thresholdCents",sku,"amountCents","monthlyCeilingCents")
    VALUES ($1,$2,true,$3,$4,$5,false,$6,$7,$8,$9)
    ON CONFLICT ("organizationId") DO UPDATE SET
      revision=EXCLUDED.revision, enabled=true, "consentedByUserId"=EXCLUDED."consentedByUserId",
      "providerConsentRef"=EXCLUDED."providerConsentRef", "accountId"=EXCLUDED."accountId", livemode=false,
      "thresholdCents"=EXCLUDED."thresholdCents", sku=EXCLUDED.sku,
      "amountCents"=EXCLUDED."amountCents", "monthlyCeilingCents"=EXCLUDED."monthlyCeilingCents"
  `, organizationId, revision, actorUserId, receipt.setupIntentId, identity.accountId,
  binding.thresholdCents, binding.sku, binding.amountCents, binding.monthlyCeilingCents);
  await recordRequiredAudit({
    organizationId: id.organization(organizationId), actorUserId: id.user(actorUserId),
    correlationId, action: "billing.workspace_ai_auto_top_up_consent_changed",
    detail: { enabled: true, revision, thresholdCents: binding.thresholdCents, amountCents: binding.amountCents, monthlyCeilingCents: binding.monthlyCeilingCents },
  }, tx);
  await tx.$executeRawUnsafe(`UPDATE "AutomaticAICreditSetupAttempt" SET state='consumed' WHERE id=$1`, binding.attemptId);
  return { kind: "saved", revision } as const;
}

/** Revokes local purchase authority while preserving unresolved intents and
 * consumed setup receipts. Call in the same serializable audit transaction. */
export async function disableAutomaticTopUpConsent(
  tx: Transaction,
  scope: { organizationId: string; userId: string; expectedRevision: number | null; correlationId: CorrelationId },
) {
  const { organizationId, userId, expectedRevision, correlationId } = scope;
  await lockPublicOrganization(tx, organizationId);
  if (!await isBillingManager(tx, organizationId, userId)) return { kind: "forbidden" } as const;
  const current = await currentConsent(tx, organizationId);
  if ((current?.revision ?? null) !== expectedRevision) return { kind: "conflict" } as const;
  const canceled = await tx.$executeRawUnsafe(
    `UPDATE "AutomaticAICreditSetupAttempt" SET state='canceled' WHERE "organizationId"=$1 AND state='pending'`, organizationId,
  );
  const revision = current?.enabled ? current.revision + 1 : current?.revision ?? null;
  if (current?.enabled) {
    await tx.$executeRawUnsafe('UPDATE "AutomaticAICreditTopUpConsent" SET enabled=false,revision=$2 WHERE "organizationId"=$1', organizationId, revision);
  }
  if (current?.enabled || canceled > 0) {
    await recordRequiredAudit({
      organizationId: id.organization(organizationId), actorUserId: id.user(userId),
      correlationId, action: "billing.workspace_ai_auto_top_up_consent_changed",
      detail: { enabled: false, revision, setupCanceled: canceled > 0 },
    }, tx);
  }
  return { kind: "off", revision } as const;
}
