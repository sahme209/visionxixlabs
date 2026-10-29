import { prisma } from "@/lib/db";
import { runAgent } from "../agent/runAgent";
import { diffRuns } from "./diffEngine";
import { compareAgentRuns } from "../diffEngine";
import { buildNotifications } from "./notifications";
import type { SchedulerResult, CreateScheduleInput, ScheduledRunNotification } from "./types";
import type { ScheduleFrequency } from "../enums";

// ---------------------------------------------------------------------------
// processScheduledRuns — called by cron, processes all due schedules
//
// Safety: never auto-applies. Scheduled runs produce findings, recommendations,
// and execution plans, but all actions remain in "approval_required" state.
// ---------------------------------------------------------------------------

const MAX_CONSECUTIVE_FAILURES = 3;

export async function processScheduledRuns(): Promise<SchedulerResult> {
  const now = new Date();

  const dueSchedules = await prisma.axiomScheduledRun.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
      consecutiveFailures: { lt: MAX_CONSECUTIVE_FAILURES },
    },
    include: {
      cloudAccount: {
        select: {
          id: true,
          provider: true,
          organizationId: true,
          externalAccountId: true,
          enabled: true,
          credentialRef: true,
        },
      },
    },
    orderBy: { nextRunAt: "asc" },
    take: 20,
  });

  const result: SchedulerResult = {
    processed: dueSchedules.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    notifications: [],
  };

  for (const schedule of dueSchedules) {
    // The relation uses an account ID, not a composite tenant key. Never let
    // a corrupt/historical cross-tenant link become system execution authority.
    if (schedule.organizationId !== schedule.cloudAccount.organizationId) {
      result.skipped++;
      await incrementFailures(schedule.id);
      continue;
    }
    // Claim before external work. A lost claim never grants dispatch authority.
    // Advance once here, never again at completion. A crash after this point
    // can skip this occurrence; uncertain work must not be automatically replayed.
    const claimedAt = new Date(Math.max(Date.now(), schedule.updatedAt.getTime() + 1));
    const nextRunAt = computeNextRun(schedule.frequency as ScheduleFrequency);
    const claimed = await prisma.axiomScheduledRun.updateMany({
      where: {
        id: schedule.id,
        organizationId: schedule.organizationId,
        cloudAccountId: schedule.cloudAccountId,
        nextRunAt: schedule.nextRunAt,
        updatedAt: schedule.updatedAt,
        enabled: true,
        consecutiveFailures: { lt: MAX_CONSECUTIVE_FAILURES },
        cloudAccount: { is: { organizationId: schedule.organizationId } },
      },
      data: { nextRunAt, updatedAt: claimedAt },
    });
    if (claimed.count !== 1) {
      result.skipped++;
      continue;
    }
    // The timestamp is advanced strictly beyond the observed row version.
    // Admin edits and later claims invalidate this completion predicate.
    const completionWhere = {
      id: schedule.id,
      organizationId: schedule.organizationId,
      cloudAccountId: schedule.cloudAccountId,
      nextRunAt,
      updatedAt: claimedAt,
      enabled: true,
    };
    if (!schedule.cloudAccount.enabled) {
      result.skipped++;
      continue;
    }

    try {
      const runResult = await runAgent({
        organizationId: schedule.cloudAccount.organizationId,
        userId: "system-scheduler",
        connectedAccountId: schedule.cloudAccount.id,
        provider: schedule.cloudAccount.provider as "aws" | "azure" | "gcp",
        trigger: "scheduled",
      });

      if (runResult.status === "failed") {
        result.failed++;
        const completed = await prisma.axiomScheduledRun.updateMany({
          where: completionWhere,
          data: { lastRunId: runResult.runId, consecutiveFailures: { increment: 1 } },
        });

        if (completed.count !== 1) continue;
        const failNotification = buildNotifications.scanFailed(
          schedule,
          runResult,
        );
        result.notifications.push(failNotification);
        await persistNotification(failNotification);
        continue;
      }

      // Diff with previous run if one exists
      let diff = null;
      if (schedule.lastRunId) {
        try {
          diff = await diffRuns(runResult.runId, schedule.lastRunId);
        } catch {
          // Previous run may have been deleted — skip diff
        }
      }

      // Full resource-level diff for richer summaries
      let fullDiffSummary: string | null = null;
      if (schedule.lastRunId) {
        try {
          const fullDiff = await compareAgentRuns(schedule.lastRunId, runResult.runId);
          fullDiffSummary = fullDiff.summary;
        } catch {
          // Non-critical — fall back to simple diff summary
        }
      }

      const summaryToStore = fullDiffSummary ?? diff?.summary ?? null;
      const completed = await prisma.axiomScheduledRun.updateMany({
        where: completionWhere,
        data: {
          lastRunId: runResult.runId,
          consecutiveFailures: 0,
          ...(summaryToStore ? { lastDiffSummary: summaryToStore } : {}),
        },
      });

      if (completed.count !== 1) {
        result.skipped++;
        continue;
      }
      // Create notifications for significant changes
      const notifications = buildNotifications.fromDiff(
        schedule,
        runResult,
        diff,
      );

      for (const n of notifications) {
        result.notifications.push(n);
        await persistNotification(n);
      }

      // Create approval requests for actionable items (but never auto-apply)
      if (runResult.approvalRequiredCount > 0 || runResult.autoFixCount > 0) {
        await createScheduledApprovalRequest(runResult.runId, schedule);
      }

      result.succeeded++;
    } catch (e) {
      result.failed++;
      await prisma.axiomScheduledRun.updateMany({
        where: completionWhere,
        data: { consecutiveFailures: { increment: 1 } },
      });
      console.error(`[axiom scheduler] Failed schedule ${schedule.id}:`, e);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Schedule CRUD
// ---------------------------------------------------------------------------

export async function createSchedule(input: CreateScheduleInput): Promise<string> {
  const cron = frequencyToCron(input.frequency);
  const nextRunAt = computeNextRun(input.frequency);

  const schedule = await prisma.axiomScheduledRun.create({
    data: {
      organizationId: input.organizationId,
      cloudAccountId: input.cloudAccountId,
      frequency: input.frequency,
      cronExpression: cron,
      timezone: input.timezone ?? "UTC",
      nextRunAt,
    },
  });

  return schedule.id;
}

export async function updateSchedule(
  scheduleId: string,
  organizationId: string,
  updates: { frequency?: ScheduleFrequency; enabled?: boolean; timezone?: string },
): Promise<boolean> {
  const current = await prisma.axiomScheduledRun.findFirst({
    where: { id: scheduleId, organizationId },
    select: { updatedAt: true },
  });
  if (!current) return false;
  // Every administrator mutation advances the same optimistic version even
  // when wall-clock precision would otherwise produce an identical timestamp.
  const data: Record<string, unknown> = {
    updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
  };

  if (updates.frequency) {
    data.frequency = updates.frequency;
    data.cronExpression = frequencyToCron(updates.frequency);
    data.nextRunAt = computeNextRun(updates.frequency);
  }
  if (updates.enabled !== undefined) {
    data.enabled = updates.enabled;
    if (updates.enabled) data.consecutiveFailures = 0;
  }
  if (updates.timezone) {
    data.timezone = updates.timezone;
  }

  const changed = await prisma.axiomScheduledRun.updateMany({ where: { id: scheduleId, organizationId, updatedAt: current.updatedAt }, data });
  return changed.count === 1;
}

export async function deleteSchedule(scheduleId: string, organizationId: string): Promise<boolean> {
  const changed = await prisma.axiomScheduledRun.deleteMany({ where: { id: scheduleId, organizationId } });
  return changed.count === 1;
}

export async function listSchedules(organizationId: string) {
  return prisma.axiomScheduledRun.findMany({
    where: { organizationId, cloudAccount: { is: { organizationId } } },
    include: {
      cloudAccount: {
        select: { provider: true, externalAccountId: true, enabled: true },
      },
    },
    orderBy: { nextRunAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function frequencyToCron(frequency: ScheduleFrequency): string {
  switch (frequency) {
    case "daily":  return "0 9 * * *";
    case "weekly": return "0 9 * * 1";
    default: return "0 9 * * *";
  }
}

function computeNextRun(frequency: ScheduleFrequency): Date {
  const now = new Date();
  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

async function incrementFailures(scheduleId: string): Promise<void> {
  await prisma.axiomScheduledRun.update({
    where: { id: scheduleId },
    data: { consecutiveFailures: { increment: 1 } },
  });
}

async function persistNotification(n: ScheduledRunNotification): Promise<void> {
  try {
    await prisma.axiomNotification.create({
      data: {
        organizationId: n.organizationId,
        userId: n.userId,
        runId: n.runId,
        scheduledRunId: n.scheduledRunId,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data as object,
      },
    });
  } catch {
    // Notification persistence failure should not block the scheduler
  }
}

async function createScheduledApprovalRequest(
  runId: string,
  schedule: { cloudAccount: { organizationId: string } },
): Promise<void> {
  try {
    const run = await prisma.axiomAgentRun.findUnique({
      where: { id: runId },
      include: { executionPlan: { include: { items: true } } },
    });

    if (!run?.executionPlan) return;

    const actionableItems = run.executionPlan.items.filter(
      (i) => i.disposition === "auto_fix_candidate" || i.disposition === "approval_required",
    );

    if (actionableItems.length === 0) return;

    // For scheduled runs, ALL actions require approval (never auto-apply)
    await prisma.axiomApprovalRequest.create({
      data: {
        runId,
        userId: "system-scheduler",
        decision: "approve_partial",
        approvedItemIds: [],
        rejectedItemIds: [],
        note: `Scheduled scan found ${actionableItems.length} actionable item(s). Review required — scheduled scans never auto-apply.`,
      },
    });
  } catch {
    // Non-critical
  }
}
