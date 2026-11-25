import "server-only";
import type { PublicSql } from "./publicBillingStore";

/** Apply the additive migration before activating admission on every worker. */
export function workspaceAIUsageBudgetsEnabled(): boolean {
  return process.env.AXIOM_WORKSPACE_AI_USAGE_BUDGETS === "true";
}

export async function readWorkspaceAIUsageBudget(tx: Pick<PublicSql, "$queryRawUnsafe">, organizationId: string, now: Date) {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [row] = await tx.$queryRawUnsafe<Array<{
    monthlyLimitCents: number;
    warningThresholdCents: number | null;
    usedCents: string;
    heldCents: string;
  }>>(`
    SELECT b."monthlyLimitCents", b."warningThresholdCents",
      COALESCE((
        SELECT SUM(u."billedCents")
        FROM "UsageEvent" u
        WHERE u."organizationId" = b."organizationId" AND u."eventKind" = 'ai_invocation'
          AND u."createdAt" >= $2::timestamptz AT TIME ZONE 'UTC'
          AND u."createdAt" < $3::timestamptz AT TIME ZONE 'UTC'
      ), 0)::text AS "usedCents",
      COALESCE((
        SELECT SUM(h."reservedCents")
        FROM "AIUsageReservation" h
        WHERE h."organizationId" = b."organizationId" AND (
          h.status IN ('pending_settlement', 'dispatch_unknown')
          OR (h.status = 'reserved' AND (
            h."expiresAt" > $4::timestamptz AT TIME ZONE 'UTC'
            OR h."usageEventId" IS NOT NULL
            OR EXISTS (
              SELECT 1 FROM "PipelineAICallReservation" c
              WHERE c."organizationId" = h."organizationId" AND c."workspaceReservationId" = h.id
            )
          ))
        )
      ), 0)::text AS "heldCents"
    FROM "WorkspaceAIUsageBudget" b
    WHERE b."organizationId" = $1
  `, organizationId, first.toISOString(), end.toISOString(), now.toISOString());
  if (!row) return null;
  const { monthlyLimitCents, warningThresholdCents } = row;
  if (!/^\d+$/.test(row.usedCents) || !/^\d+$/.test(row.heldCents)) throw new Error("workspace_ai_budget_usage_unavailable");
  const zero = BigInt(0);
  const committed = BigInt(row.usedCents) + BigInt(row.heldCents);
  const remaining = BigInt(monthlyLimitCents) - committed;
  return {
    monthlyLimitCents,
    warningThresholdCents,
    remainingCents: remaining > zero ? Number(remaining) : 0,
    warningReached: warningThresholdCents !== null && committed >= BigInt(warningThresholdCents),
  };
}

/** Call inside the same serializable transaction that inserts the hold. */
export async function exceedsWorkspaceAIUsageBudget(
  tx: Pick<PublicSql, "$queryRawUnsafe">, input: { organizationId: string; reservedCents: number }, now: Date,
): Promise<boolean> {
  if (!workspaceAIUsageBudgetsEnabled()) return false;
  const budget = await readWorkspaceAIUsageBudget(tx, input.organizationId, now);
  return budget !== null && input.reservedCents > budget.remainingCents;
}
