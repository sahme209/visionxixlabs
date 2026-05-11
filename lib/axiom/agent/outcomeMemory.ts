import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutcomeRecord = {
  runId: string;
  recordedAt: string;
  type: "scan_outcome" | "action_outcome";
  summary: string;
  data: Record<string, unknown>;
};

export type ResourceOutcomeHistory = {
  resourceId: string;
  actions: {
    actionType: string;
    status: string;
    runId: string;
    recordedAt: string;
  }[];
  lastActionAt: string;
  failureCount: number;
  successCount: number;
};

export type OutcomeHistory = {
  cloudAccountId: string;
  totalRuns: number;
  totalActionsApplied: number;
  totalActionsFailed: number;
  totalSavingsRealized: number;
  resourceOutcomes: Map<string, ResourceOutcomeHistory>;
  recentOutcomes: OutcomeRecord[];
};

// ---------------------------------------------------------------------------
// Record outcomes
// ---------------------------------------------------------------------------

export async function recordScanOutcome(input: {
  organizationId: string;
  cloudAccountId: string;
  runId: string;
  findingCount: number;
  driftCount: number;
  savingsIdentified: { monthly: number; yearly: number };
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: "axiom_outcome_scan",
        actor: "system",
        metadata: {
          organizationId: input.organizationId,
          cloudAccountId: input.cloudAccountId,
          runId: input.runId,
          type: "scan_outcome",
          findingCount: input.findingCount,
          driftCount: input.driftCount,
          savingsMonthly: input.savingsIdentified.monthly,
          savingsYearly: input.savingsIdentified.yearly,
        },
      },
    });
  } catch {}
}

export async function recordActionOutcomes(input: {
  organizationId: string;
  cloudAccountId: string;
  runId: string;
  actions: {
    actionType: string;
    resourceIds: string[];
    status: string;
    savingsRealized: number;
    failureReason?: string;
  }[];
}): Promise<void> {
  if (input.actions.length === 0) return;
  try {
    await prisma.$transaction(
      input.actions.map((action) =>
        prisma.auditLog.create({
          data: {
            action: "axiom_outcome_action",
            actor: "system",
            metadata: {
              organizationId: input.organizationId,
              cloudAccountId: input.cloudAccountId,
              runId: input.runId,
              type: "action_outcome",
              actionType: action.actionType,
              resourceIds: action.resourceIds,
              status: action.status,
              savingsRealized: action.savingsRealized,
              failureReason: action.failureReason ?? null,
            },
          },
        }),
      ),
    );
  } catch {}
}

// ---------------------------------------------------------------------------
// Load outcome history
// ---------------------------------------------------------------------------

export async function loadOutcomeHistory(
  organizationId: string,
  cloudAccountId: string,
): Promise<OutcomeHistory> {
  let logs: { metadata: unknown; createdAt: Date }[] = [];
  try {
    logs = await prisma.auditLog.findMany({
      where: {
        action: { in: ["axiom_outcome_scan", "axiom_outcome_action"] },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { metadata: true, createdAt: true },
    });
  } catch {
    return emptyHistory(cloudAccountId);
  }

  const relevant = logs.filter((log) => {
    const meta = log.metadata as Record<string, unknown> | null;
    return meta?.organizationId === organizationId && meta?.cloudAccountId === cloudAccountId;
  });

  if (relevant.length === 0) return emptyHistory(cloudAccountId);

  const resourceOutcomes = new Map<string, ResourceOutcomeHistory>();
  let totalActionsApplied = 0;
  let totalActionsFailed = 0;
  let totalSavingsRealized = 0;
  const scanRunIds = new Set<string>();

  for (const log of relevant) {
    const meta = log.metadata as Record<string, unknown>;

    if (meta.type === "scan_outcome") {
      scanRunIds.add(meta.runId as string);
    }

    if (meta.type === "action_outcome") {
      const resourceIds = (meta.resourceIds as string[]) ?? [];
      const status = meta.status as string;
      const actionType = meta.actionType as string;

      if (status === "verified" || status === "applied") {
        totalActionsApplied++;
        totalSavingsRealized += (meta.savingsRealized as number) ?? 0;
      } else if (status === "failed") {
        totalActionsFailed++;
      }

      for (const resourceId of resourceIds) {
        if (!resourceOutcomes.has(resourceId)) {
          resourceOutcomes.set(resourceId, {
            resourceId,
            actions: [],
            lastActionAt: log.createdAt.toISOString(),
            failureCount: 0,
            successCount: 0,
          });
        }
        const history = resourceOutcomes.get(resourceId)!;
        history.actions.push({
          actionType,
          status,
          runId: meta.runId as string,
          recordedAt: log.createdAt.toISOString(),
        });
        if (status === "failed") history.failureCount++;
        else if (status === "verified" || status === "applied") history.successCount++;
      }
    }
  }

  const recentOutcomes: OutcomeRecord[] = relevant.slice(0, 20).map((log) => {
    const meta = log.metadata as Record<string, unknown>;
    return {
      runId: meta.runId as string,
      recordedAt: log.createdAt.toISOString(),
      type: meta.type as "scan_outcome" | "action_outcome",
      summary:
        meta.type === "scan_outcome"
          ? `Scan: ${meta.findingCount} findings, ${meta.driftCount} drifts`
          : `${meta.actionType} on ${(meta.resourceIds as string[])?.length ?? 0} resources: ${meta.status}`,
      data: meta,
    };
  });

  return {
    cloudAccountId,
    totalRuns: scanRunIds.size,
    totalActionsApplied,
    totalActionsFailed,
    totalSavingsRealized,
    resourceOutcomes,
    recentOutcomes,
  };
}

// ---------------------------------------------------------------------------
// Query helpers — used by the agent to inform decisions
// ---------------------------------------------------------------------------

export function hasResourceFailureHistory(
  history: OutcomeHistory,
  resourceId: string,
  actionType: string,
): boolean {
  const rh = history.resourceOutcomes.get(resourceId);
  if (!rh) return false;
  return rh.actions.some((a) => a.actionType === actionType && a.status === "failed");
}

export function getOutcomeSuccessRate(
  history: OutcomeHistory,
  resourceId: string,
  actionType: string,
): number | null {
  const rh = history.resourceOutcomes.get(resourceId);
  if (!rh) return null;
  const relevant = rh.actions.filter((a) => a.actionType === actionType);
  if (relevant.length === 0) return null;
  return relevant.filter((a) => a.status === "verified" || a.status === "applied").length / relevant.length;
}

export function getOutcomeSummaryText(history: OutcomeHistory): string {
  if (history.totalRuns === 0) return "No prior scan history for this account.";
  const parts: string[] = [];
  parts.push(`${history.totalRuns} prior scan${history.totalRuns === 1 ? "" : "s"}.`);
  if (history.totalActionsApplied > 0) {
    parts.push(`${history.totalActionsApplied} action${history.totalActionsApplied === 1 ? "" : "s"} applied successfully.`);
  }
  if (history.totalActionsFailed > 0) {
    parts.push(`${history.totalActionsFailed} action${history.totalActionsFailed === 1 ? "" : "s"} failed.`);
  }
  if (history.totalSavingsRealized > 0) {
    parts.push(`$${history.totalSavingsRealized.toLocaleString()}/mo in realized savings.`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function emptyHistory(cloudAccountId: string): OutcomeHistory {
  return {
    cloudAccountId,
    totalRuns: 0,
    totalActionsApplied: 0,
    totalActionsFailed: 0,
    totalSavingsRealized: 0,
    resourceOutcomes: new Map(),
    recentOutcomes: [],
  };
}
