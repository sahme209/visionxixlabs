import "server-only";

import { randomUUID } from "node:crypto";
import { findAddOn } from "./addOnCatalog";
import { lockPublicOrganization, type PublicSqlRepository } from "./publicBillingStore";
import { publicDatabaseNow, readPublicCreditAllowance } from "./publicCreditAuthority";
import type { PublicBillingIdentity } from "./publicCheckoutService";

type Consent = {
  revision: number;
  enabled: boolean;
  consentedByUserId: string;
  providerConsentRef: string;
  setupReceipt: string | null;
  setupCustomerId: string | null;
  accountId: string;
  livemode: boolean;
  thresholdCents: number;
  sku: string;
  amountCents: number;
  monthlyCeilingCents: number;
};

type Preparation =
  | { kind: "prepared"; intentId: string; periodMonth: string; amountCents: number }
  | { kind: "off" | "unavailable" | "consent_invalid" | "balance_sufficient" | "payment_pending" | "monthly_ceiling" };

/**
 * Local, test-mode-only intent preparation. A prepared row grants no authority
 * to call a payment provider or modify credits. Future dispatch must recheck
 * external consent, the current revision and the committed month before any IO.
 */
export async function prepareAutomaticAICreditTopUp(
  repo: PublicSqlRepository,
  organizationId: string,
  identity: PublicBillingIdentity,
): Promise<Preparation> {
  if (identity.livemode !== false) return { kind: "unavailable" };
  try {
    return await repo.$transaction(async (tx): Promise<Preparation> => {
      await lockPublicOrganization(tx, organizationId);
      const [consent] = await tx.$queryRawUnsafe<Consent[]>(`
        SELECT c.revision, c.enabled, c."consentedByUserId", c."providerConsentRef", c."accountId", c.livemode,
          c."thresholdCents", c.sku, c."amountCents", c."monthlyCeilingCents", r."setupIntentId" AS "setupReceipt", r."customerId" AS "setupCustomerId"
        FROM "AutomaticAICreditTopUpConsent" c
        LEFT JOIN "AutomaticAICreditSetupReceipt" r ON r."setupIntentId"=c."providerConsentRef"
          AND r."organizationId"=c."organizationId" AND r."consentRevision"=c.revision
        WHERE c."organizationId"=$1 FOR UPDATE OF c
      `, organizationId);
      if (!consent?.enabled) return { kind: "off" };
      const pack = findAddOn(consent.sku);
      if (consent.accountId !== identity.accountId || consent.livemode !== false || consent.setupReceipt !== consent.providerConsentRef || !consent.setupCustomerId
          || pack?.category !== "ai_credits" || pack.priceCents !== consent.amountCents) {
        return { kind: "consent_invalid" };
      }
      const members = await tx.$queryRawUnsafe<Array<{ role: string }>>(`
        SELECT role FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2 AND "acceptedAt" IS NOT NULL FOR SHARE
      `, organizationId, consent.consentedByUserId);
      if (members.length !== 1 || !["owner", "admin"].includes(members[0].role)) return { kind: "consent_invalid" };
      const customerOwners = await tx.$queryRawUnsafe<Array<{ organizationId: string }>>(
        'SELECT "organizationId" FROM "TenantBillingPlan" WHERE "stripeCustomerId"=$1 FOR SHARE', consent.setupCustomerId,
      );
      if (customerOwners.length !== 1 || customerOwners[0].organizationId !== organizationId) return { kind: "consent_invalid" };
      const now = await publicDatabaseNow(tx);
      const periodMonth = now.toISOString().slice(0, 7);
      const [ledger] = await tx.$queryRawUnsafe<Array<{ pending: boolean; paidCents: string }>>(`
        SELECT COALESCE(bool_or(state IN ('prepared','dispatch_unknown','authentication_required','payment_failed')), false) AS pending,
          COALESCE(sum("amountCents") FILTER (WHERE state='paid' AND "periodMonth"=$2), 0)::text AS "paidCents"
        FROM "AutomaticAICreditTopUpIntent" WHERE "organizationId"=$1
      `, organizationId, periodMonth);
      if (ledger.pending) return { kind: "payment_pending" };
      if (BigInt(ledger.paidCents) + BigInt(consent.amountCents) > BigInt(consent.monthlyCeilingCents)) {
        return { kind: "monthly_ceiling" };
      }
      const balance = await readPublicCreditAllowance(tx, organizationId, identity, now);
      if (!balance?.available) return { kind: "unavailable" };
      if (balance.includedRemainingCents > consent.thresholdCents) return { kind: "balance_sufficient" };
      const intentId = randomUUID();
      await tx.$executeRawUnsafe(`
        INSERT INTO "AutomaticAICreditTopUpIntent"
          (id,"organizationId","consentRevision","periodMonth",sku,"amountCents",state,"createdAt")
        VALUES ($1,$2,$3,$4,$5,$6,'prepared',$7::timestamptz AT TIME ZONE 'UTC')
      `, intentId, organizationId, consent.revision, periodMonth, pack.sku, pack.priceCents, now.toISOString());
      return { kind: "prepared", intentId, periodMonth, amountCents: pack.priceCents };
    }, { isolationLevel: "Serializable" });
  } catch {
    return { kind: "unavailable" };
  }
}
