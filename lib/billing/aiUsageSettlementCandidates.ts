import { Prisma } from "@prisma/client";
import { MAX_AUTOMATIC_RETRY_AGE_MS } from "./aiUsageSettlementRetryPolicy";

/** Select unreserved usage or matching reservations still eligible for retry.
 * Held records remain untouched. The worker rechecks eligibility before Stripe. */
export function aiUsageSettlementCandidates(limit: number, now = new Date()): Prisma.Sql {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid settlement selection time");
  const cutoff = new Date(now.getTime() - MAX_AUTOMATIC_RETRY_AGE_MS);
  const periodMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const batchSize = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 100;
  return Prisma.sql`
    SELECT u."id", u."organizationId", u."billedCents"
    FROM "UsageEvent" AS u
    JOIN "AIUsageBillingConfig" AS c ON c."organizationId" = u."organizationId"
    JOIN "TenantBillingPlan" AS b ON b."organizationId" = u."organizationId"
    LEFT JOIN "AIUsageBillingPeriod" AS p
      ON p."organizationId" = u."organizationId" AND p."periodMonth" = ${periodMonth}
    WHERE u."billingStatus" = 'settled' AND u."billedCents" > 0
      AND c."enabled" = true AND c."monthlySpendLimitCents" > 0
      AND b."stripeCustomerId" IS NOT NULL AND LENGTH(TRIM(b."stripeCustomerId")) > 0
      AND (NOT EXISTS (
        SELECT 1 FROM "AIUsageBillingSettlement" AS s
        WHERE s."usageEventId" = u."id"
      ) AND u."billedCents" <= c."monthlySpendLimitCents"
        AND (p."organizationId" IS NULL OR (p."reservedCents" >= 0
          AND p."reservedCents" <= c."monthlySpendLimitCents" - u."billedCents"))
      OR EXISTS (
        SELECT 1 FROM "AIUsageBillingSettlement" AS s
        WHERE s."usageEventId" = u."id" AND s."status" = 'reserved'
          AND s."organizationId" = u."organizationId"
          AND s."amountCents" = u."billedCents"
          AND s."createdAt" > ${cutoff} AND s."createdAt" <= ${now}
      ))
    ORDER BY COALESCE((
      SELECT s."updatedAt" FROM "AIUsageBillingSettlement" AS s
      WHERE s."usageEventId" = u."id"
    ), u."createdAt") ASC, u."createdAt" ASC, u."id" ASC
    LIMIT ${batchSize}
  `;
}
