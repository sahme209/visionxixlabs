import { prisma } from "@/lib/db";
import { runAgent } from "../agent/runAgent";
import { diffRuns } from "./diffEngine";
import { compareAgentRuns } from "../diffEngine";
import { buildNotifications } from "./notifications";
import type { SchedulerResult, CreateScheduleInput } from "./types";
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
    if (!schedule.cloudAccount.enabled) {
      result.skipped++;
      await advanceSchedule(schedule.id, schedule.frequency as ScheduleFrequency, null);
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
        await incrementFailures(schedule.id);
        await advanceSchedule(schedule.id, schedule.frequency as ScheduleFrequency, runResult.runId);

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

      await advanceSchedule(schedule.id, schedule.frequency as ScheduleFrequency, runResult.runId);
      await resetFailures(schedule.id);

      const summaryToStore = fullDiffSummary ?? diff?.summary ?? null;
      if (summaryToStore) {
        await prisma.axiomScheduledRun.update({
          where: { id: schedule.id },
          data: { lastDiffSummary: summaryToStore },
        });
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
      await incrementFailures(schedule.id);
      await advanceSchedule(schedule.id, schedule.frequency as ScheduleFrequency, null);
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
  updates: { frequency?: ScheduleFrequency; enabled?: boolean; timezone?: string },
): Promise<void> {
  const data: Record<string, unknown> = {};

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

  await prisma.axiomScheduledRun.update({ where: { id: scheduleId }, data });
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  await prisma.axiomScheduledRun.delete({ where: { id: scheduleId } });
}

export async function listSchedules(organizationId: string) {
  return prisma.axiomScheduledRun.findMany({
    where: { organizationId },
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
  }
}

function computeNextRun(frequency: ScheduleFrequency): Date {
  const now = new Date();
  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

async function advanceSchedule(
  scheduleId: string,
  frequency: ScheduleFrequency,
  lastRunId: string | null,
): Promise<void> {
  const nextRunAt = computeNextRun(frequency);
  const data: Record<string, unknown> = { nextRunAt };
  if (lastRunId) data.lastRunId = lastRunId;

  await prisma.axiomScheduledRun.update({ where: { id: scheduleId }, data });
}

async function incrementFailures(scheduleId: string): Promise<void> {
  await prisma.axiomScheduledRun.update({
    where: { id: scheduleId },
    data: { consecutiveFailures: { increment: 1 } },
  });
}

async function resetFailures(scheduleId: string): Promise<void> {
  await prisma.axiomScheduledRun.update({
    where: { id: scheduleId },
    data: { consecutiveFailures: 0 },
  });
}

async function persistNotification(n: {
  type: string;
  organizationId: string;
  userId: string | null;
  runId: string;
  scheduledRunId: string;
  title: string;
  body: string;
  data: unknown;
}): Promise<void> {
  try {
    await prisma.axiomNotification.create({
      data: {
        organizationId: n.organizationId,
        userId: n.userId,
        runId: n.runId,
        scheduledRunId: n.scheduledRunId,
        type: n.type as any,
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
