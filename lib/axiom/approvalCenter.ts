import { prisma } from "@/lib/db";
import type { CloudProvider } from "./cloudSnapshot";
import type { ActionType, RiskLevel } from "./executionPlan";
import type { ActionDisposition } from "./agent/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApprovalItemStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "snoozed"
  | "applied"
  | "failed"
  | "expired";

export type ApprovalCenterItem = {
  id: string;
  runId: string;
  planItemId: string;
  status: ApprovalItemStatus;

  title: string;
  actionType: ActionType;
  provider: CloudProvider;
  region: string;
  resourceCount: number;
  resourceIds: string[];

  riskLevel: RiskLevel;
  disposition: ActionDisposition;
  dispositionReason: string;

  currentState: string;
  recommendedState: string;

  monthlySavings: { low: number; high: number };
  yearlySavings: { low: number; high: number };

  rollbackAvailable: boolean;
  rollbackComplexity: string | null;
  precheckPassed: boolean;
  terraformAvailable: boolean;

  accountAlias: string | null;
  accountId: string;
  triggerType: string;
  createdAt: string;
  snoozedUntil: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  errorMessage: string | null;

  canApprove: boolean;
  canReject: boolean;
  canSnooze: boolean;
};

export type ApprovalCenterSummary = {
  pending: number;
  snoozed: number;
  approved: number;
  rejected: number;
  applied: number;
  failed: number;
  totalSavingsYearlyHigh: number;
};

export type ApprovalDecisionInput = {
  itemId: string;
  userId: string;
  action: "approve" | "reject" | "snooze";
  note?: string;
  snoozeDays?: number;
};

export type BatchDecisionInput = {
  itemIds: string[];
  userId: string;
  action: "approve" | "reject";
  note?: string;
};

// ---------------------------------------------------------------------------
// VALID STATUS TRANSITIONS
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<string, Set<string>> = {
  pending:  new Set(["approved", "rejected", "snoozed", "expired"]),
  snoozed:  new Set(["pending", "approved", "rejected", "expired"]),
  approved: new Set(["applied", "failed"]),
  rejected: new Set([]),
  applied:  new Set([]),
  failed:   new Set(["approved"]),
  expired:  new Set([]),
};

function canTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.has(to) ?? false;
}

// ---------------------------------------------------------------------------
// createApprovalItems — called after execution plan is built
//
// Converts execution plan items with approval_required or auto_fix_candidate
// disposition into individual approval center items.
// Idempotent: upserts by (runId, planItemId).
// ---------------------------------------------------------------------------

export async function createApprovalItems(runId: string): Promise<number> {
  const run = await prisma.axiomAgentRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      cloudAccount: { select: { alias: true, externalAccountId: true } },
      executionPlan: {
        include: {
          items: {
            where: {
              disposition: { in: ["approval_required", "auto_fix_candidate"] },
            },
            include: {
              recommendation: { select: { title: true, rationale: true, dispositionReason: true } },
            },
          },
        },
      },
    },
  });

  const plan = run.executionPlan;
  if (!plan || plan.items.length === 0) return 0;

  const items = plan.items.map((item) => ({
    organizationId: run.organizationId,
    runId,
    planItemId: item.id,
    title: item.recommendation?.title ?? `${item.actionType} in ${item.region}`,
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    resourceIds: item.resourceIds as object,
    currentState: item.currentState,
    recommendedState: item.recommendedState,
    riskLevel: item.riskLevel,
    disposition: item.disposition,
    dispositionReason: item.recommendation?.dispositionReason ?? "",
    monthlyLow: item.monthlyLow,
    monthlyHigh: item.monthlyHigh,
    yearlyLow: item.yearlyLow,
    yearlyHigh: item.yearlyHigh,
    rollbackAvailable: item.rollbackPlan !== null,
    rollbackComplexity: plan.rollbackComplexity,
    precheckPassed: item.precheckResult
      ? (item.precheckResult as { passed?: boolean }).passed !== false
      : true,
  }));

  await prisma.$transaction(
    items.map((item) =>
      prisma.axiomApprovalItem.upsert({
        where: {
          runId_planItemId: { runId: item.runId, planItemId: item.planItemId },
        },
        create: item,
        update: {},
      }),
    ),
  );

  return items.length;
}

// ---------------------------------------------------------------------------
// listPendingApprovals — the main Approval Center query
// ---------------------------------------------------------------------------

export async function listPendingApprovals(
  organizationId: string,
  filters?: {
    provider?: string;
    riskLevel?: string;
    status?: ApprovalItemStatus;
  },
): Promise<{ items: ApprovalCenterItem[]; summary: ApprovalCenterSummary }> {
  // Resurface snoozed items whose snooze period has expired
  await prisma.axiomApprovalItem.updateMany({
    where: {
      organizationId,
      status: "snoozed",
      snoozedUntil: { lte: new Date() },
    },
    data: { status: "pending", snoozedUntil: null },
  });

  const where: Record<string, unknown> = { organizationId };

  if (filters?.status) {
    where.status = filters.status;
  } else {
    where.status = { in: ["pending", "snoozed"] };
  }

  if (filters?.provider) {
    where.provider = filters.provider;
  }
  if (filters?.riskLevel) {
    where.riskLevel = filters.riskLevel;
  }

  const dbItems = await prisma.axiomApprovalItem.findMany({
    where,
    orderBy: [
      { riskLevel: "desc" },
      { yearlyHigh: "desc" },
      { createdAt: "desc" },
    ],
  });

  // Load run context for each unique run
  const runIds = [...new Set(dbItems.map((i) => i.runId))];
  const runs = await prisma.axiomAgentRun.findMany({
    where: { id: { in: runIds } },
    select: {
      id: true,
      trigger: true,
      cloudAccount: { select: { alias: true, externalAccountId: true } },
      executionPlan: { select: { id: true } },
    },
  });
  const runMap = new Map(runs.map((r) => [r.id, r]));

  // Check terraform availability per run (plan exists = terraform exportable)
  const planRunIds = new Set(runs.filter((r) => r.executionPlan).map((r) => r.id));

  const items: ApprovalCenterItem[] = dbItems.map((item) => {
    const run = runMap.get(item.runId);
    const status = item.status as ApprovalItemStatus;

    return {
      id: item.id,
      runId: item.runId,
      planItemId: item.planItemId,
      status,

      title: item.title,
      actionType: item.actionType as ActionType,
      provider: item.provider as CloudProvider,
      region: item.region,
      resourceCount: (item.resourceIds as string[]).length,
      resourceIds: item.resourceIds as string[],

      riskLevel: item.riskLevel as RiskLevel,
      disposition: item.disposition as ActionDisposition,
      dispositionReason: item.dispositionReason,

      currentState: item.currentState,
      recommendedState: item.recommendedState,

      monthlySavings: { low: item.monthlyLow, high: item.monthlyHigh },
      yearlySavings: { low: item.yearlyLow, high: item.yearlyHigh },

      rollbackAvailable: item.rollbackAvailable,
      rollbackComplexity: item.rollbackComplexity,
      precheckPassed: item.precheckPassed,
      terraformAvailable: planRunIds.has(item.runId),

      accountAlias: run?.cloudAccount?.alias ?? null,
      accountId: run?.cloudAccount?.externalAccountId ?? "",
      triggerType: run?.trigger ?? "manual",
      createdAt: item.createdAt.toISOString(),
      snoozedUntil: item.snoozedUntil?.toISOString() ?? null,
      decidedBy: item.decidedBy,
      decidedAt: item.decidedAt?.toISOString() ?? null,
      note: item.note,
      errorMessage: item.errorMessage,

      canApprove: status === "pending" || status === "snoozed" || status === "failed",
      canReject: status === "pending" || status === "snoozed",
      canSnooze: status === "pending",
    };
  });

  // Summary counts across ALL items for this org (not just filtered)
  const allCounts = await prisma.axiomApprovalItem.groupBy({
    by: ["status"],
    where: { organizationId },
    _count: true,
    _sum: { yearlyHigh: true },
  });

  const summary: ApprovalCenterSummary = {
    pending: 0,
    snoozed: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
    failed: 0,
    totalSavingsYearlyHigh: 0,
  };

  for (const row of allCounts) {
    const s = row.status as keyof ApprovalCenterSummary;
    if (s in summary && typeof summary[s] === "number") {
      (summary as Record<string, number>)[s] = row._count;
    }
  }

  const pendingSavings = allCounts
    .filter((r) => r.status === "pending" || r.status === "snoozed")
    .reduce((s, r) => s + (r._sum.yearlyHigh ?? 0), 0);
  summary.totalSavingsYearlyHigh = pendingSavings;

  return { items, summary };
}

// ---------------------------------------------------------------------------
// decideItem — approve, reject, or snooze a single item
// ---------------------------------------------------------------------------

export async function decideItem(
  input: ApprovalDecisionInput,
): Promise<{ success: boolean; item: { id: string; status: string }; error?: string }> {
  const item = await prisma.axiomApprovalItem.findUniqueOrThrow({
    where: { id: input.itemId },
  });

  const targetStatus = actionToStatus(input.action);

  if (!canTransition(item.status, targetStatus)) {
    return {
      success: false,
      item: { id: item.id, status: item.status },
      error: `Cannot ${input.action} an item with status '${item.status}'.`,
    };
  }

  const data: Record<string, unknown> = {
    status: targetStatus,
    decidedBy: input.userId,
    decidedAt: new Date(),
    note: input.note ?? item.note,
  };

  if (input.action === "snooze") {
    const days = input.snoozeDays ?? 7;
    data.snoozedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  if (input.action === "approve" || input.action === "reject") {
    data.snoozedUntil = null;
  }

  const updated = await prisma.axiomApprovalItem.update({
    where: { id: input.itemId },
    data,
  });

  return {
    success: true,
    item: { id: updated.id, status: updated.status },
  };
}

// ---------------------------------------------------------------------------
// batchDecide — approve or reject multiple items at once
// ---------------------------------------------------------------------------

export async function batchDecide(
  input: BatchDecisionInput,
): Promise<{ succeeded: number; failed: number; results: Array<{ id: string; status: string; error?: string }> }> {
  const results: Array<{ id: string; status: string; error?: string }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const itemId of input.itemIds) {
    const result = await decideItem({
      itemId,
      userId: input.userId,
      action: input.action,
      note: input.note,
    });

    if (result.success) {
      succeeded++;
      results.push({ id: result.item.id, status: result.item.status });
    } else {
      failed++;
      results.push({ id: itemId, status: result.item.status, error: result.error });
    }
  }

  return { succeeded, failed, results };
}

// ---------------------------------------------------------------------------
// markApplied / markFailed — called after execution
// ---------------------------------------------------------------------------

export async function markApplied(planItemId: string, runId: string): Promise<void> {
  await prisma.axiomApprovalItem.updateMany({
    where: { planItemId, runId, status: "approved" },
    data: { status: "applied" },
  });
}

export async function markFailed(planItemId: string, runId: string, errorMessage: string): Promise<void> {
  await prisma.axiomApprovalItem.updateMany({
    where: { planItemId, runId, status: "approved" },
    data: { status: "failed", errorMessage },
  });
}

// ---------------------------------------------------------------------------
// expireStaleItems — expire items from runs that are too old
// ---------------------------------------------------------------------------

export async function expireStaleItems(maxAgeDays: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  const result = await prisma.axiomApprovalItem.updateMany({
    where: {
      status: { in: ["pending", "snoozed"] },
      createdAt: { lt: cutoff },
    },
    data: { status: "expired" },
  });

  return result.count;
}

// ---------------------------------------------------------------------------
// getItemHistory — full decision history for a single item
// ---------------------------------------------------------------------------

export async function getItemHistory(
  planItemId: string,
): Promise<Array<{ runId: string; status: string; decidedBy: string | null; decidedAt: string | null; note: string | null; createdAt: string }>> {
  const items = await prisma.axiomApprovalItem.findMany({
    where: { planItemId },
    orderBy: { createdAt: "desc" },
    select: {
      runId: true,
      status: true,
      decidedBy: true,
      decidedAt: true,
      note: true,
      createdAt: true,
    },
  });

  return items.map((i) => ({
    runId: i.runId,
    status: i.status,
    decidedBy: i.decidedBy,
    decidedAt: i.decidedAt?.toISOString() ?? null,
    note: i.note,
    createdAt: i.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionToStatus(action: "approve" | "reject" | "snooze"): ApprovalItemStatus {
  switch (action) {
    case "approve": return "approved";
    case "reject": return "rejected";
    case "snooze": return "snoozed";
  }
}
