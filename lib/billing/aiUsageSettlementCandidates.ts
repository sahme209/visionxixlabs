import { Prisma } from "@prisma/client";

/** Exclude durably submitted rows before LIMIT, so completed work cannot
 * occupy every slot of each subsequent settlement batch. Values stay bound. */
export function aiUsageSettlementCandidates(limit: number): Prisma.Sql {
  const batchSize = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 100;
  return Prisma.sql`
    SELECT u."id", u."organizationId", u."billedCents"
    FROM "UsageEvent" AS u
    WHERE u."billingStatus" = 'settled' AND u."billedCents" > 0
      AND NOT EXISTS (
        SELECT 1 FROM "AIUsageBillingSettlement" AS s
        WHERE s."usageEventId" = u."id" AND s."status" = 'submitted'
      )
    ORDER BY u."createdAt" ASC, u."id" ASC
    LIMIT ${batchSize}
  `;
}
