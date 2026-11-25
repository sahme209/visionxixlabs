import "server-only";
import type { Prisma } from "@/lib/prismaClient";
import { recordRequiredAudit } from "@/lib/audit/requiredAudit";
import { id, type CorrelationId } from "@/lib/domain/ids";
import { readWorkspaceAIUsageBudget } from "./workspaceAIUsageBudget";

type BudgetScope = { organizationId: string; userId: string };
type BudgetValues = { monthlyLimitCents: number; warningThresholdCents: number | null };
type BudgetRevision = BudgetValues & { revision: Date };
type BudgetTransaction = Pick<Prisma.TransactionClient, "$queryRawUnsafe" | "$executeRawUnsafe" | "secureAuditRecord">;

export async function canManageWorkspaceAIUsageBudget(tx: BudgetTransaction, scope: BudgetScope): Promise<boolean> {
  const rows = await tx.$queryRawUnsafe<Array<{ role: string }>>(
    'SELECT role FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2 AND "acceptedAt" IS NOT NULL FOR SHARE',
    scope.organizationId, scope.userId,
  );
  return rows.length === 1 && (rows[0].role === "owner" || rows[0].role === "admin");
}

async function budgetRevision(tx: BudgetTransaction, organizationId: string) {
  const rows = await tx.$queryRawUnsafe<BudgetRevision[]>(
    'SELECT "monthlyLimitCents","warningThresholdCents","updatedAt" AS revision FROM "WorkspaceAIUsageBudget" WHERE "organizationId"=$1',
    organizationId,
  );
  return rows[0] ?? null;
}

async function budgetSettings(tx: BudgetTransaction, organizationId: string) {
  const current = await budgetRevision(tx, organizationId);
  const [clock] = await tx.$queryRawUnsafe<Array<{ now: Date }>>("SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now");
  const budget = current && await readWorkspaceAIUsageBudget(tx, organizationId, clock.now);
  return { organizationId, revision: current?.revision.toISOString() ?? null, budget };
}

export async function readWorkspaceBudgetSettings(tx: BudgetTransaction, scope: BudgetScope) {
  if (!await canManageWorkspaceAIUsageBudget(tx, scope)) return { kind: "forbidden" } as const;
  return { kind: "ok", data: await budgetSettings(tx, scope.organizationId) } as const;
}

/** Call in a serializable transaction with the required audit write. */
export async function saveWorkspaceBudgetSettings(
  tx: BudgetTransaction,
  scope: BudgetScope,
  input: { correlationId: CorrelationId; expectedRevision: string | null; budget: BudgetValues | null },
) {
  if (!await canManageWorkspaceAIUsageBudget(tx, scope)) return { kind: "forbidden" } as const;
  const current = await budgetRevision(tx, scope.organizationId);
  if ((current?.revision.toISOString() ?? null) !== input.expectedRevision) return { kind: "conflict" } as const;
  const next = input.budget;
  const changed = (current?.monthlyLimitCents ?? null) !== (next?.monthlyLimitCents ?? null)
    || (current?.warningThresholdCents ?? null) !== (next?.warningThresholdCents ?? null);
  if (changed) {
    if (next) {
      await tx.$executeRawUnsafe(`
        INSERT INTO "WorkspaceAIUsageBudget" ("organizationId","monthlyLimitCents","warningThresholdCents","updatedAt")
        VALUES ($1,$2,$3,clock_timestamp() AT TIME ZONE 'UTC')
        ON CONFLICT ("organizationId") DO UPDATE SET
          "monthlyLimitCents"=EXCLUDED."monthlyLimitCents", "warningThresholdCents"=EXCLUDED."warningThresholdCents",
          "updatedAt"=GREATEST(EXCLUDED."updatedAt","WorkspaceAIUsageBudget"."updatedAt"+interval '1 millisecond')
      `, scope.organizationId, next.monthlyLimitCents, next.warningThresholdCents);
    } else {
      await tx.$executeRawUnsafe('DELETE FROM "WorkspaceAIUsageBudget" WHERE "organizationId"=$1', scope.organizationId);
    }
    await recordRequiredAudit({
      organizationId: id.organization(scope.organizationId), actorUserId: id.user(scope.userId),
      correlationId: input.correlationId, action: "billing.workspace_ai_budget_changed",
      detail: {
        hadBudget: current !== null, hasBudget: next !== null,
        previousMonthlyLimitCents: current?.monthlyLimitCents,
        previousWarningThresholdCents: current?.warningThresholdCents ?? undefined,
        monthlyLimitCents: next?.monthlyLimitCents,
        warningThresholdCents: next?.warningThresholdCents ?? undefined,
      },
    }, tx);
  }
  return { kind: "ok", data: await budgetSettings(tx, scope.organizationId) } as const;
}
