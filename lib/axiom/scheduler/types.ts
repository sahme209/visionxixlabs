import type { NotificationType, ScheduleFrequency } from "../enums";

// ---------------------------------------------------------------------------
// Scan diff — result of comparing two consecutive agent runs
// ---------------------------------------------------------------------------

export type DiffFinding = {
  title: string;
  severity: string;
  region: string;
  yearlyHigh: number;
};

export type ScanDiff = {
  currentRunId: string;
  previousRunId: string;
  newFindings: DiffFinding[];
  resolvedFindings: DiffFinding[];
  newHighRiskCount: number;
  savingsDelta: { low: number; high: number };
  resourceCountDelta: number;
  findingCountDelta: number;
  isSignificant: boolean;
  summary: string;
};

// ---------------------------------------------------------------------------
// Notification payload — what gets stored and (optionally) emailed
// ---------------------------------------------------------------------------

export type ScheduledRunNotification = {
  type: NotificationType;
  organizationId: string;
  userId: string | null;
  runId: string;
  scheduledRunId: string;
  title: string;
  body: string;
  data: {
    provider: string;
    accountId: string;
    diff: ScanDiff | null;
    runSummary: string;
  };
};

// ---------------------------------------------------------------------------
// Scheduler execution result — returned by processScheduledRuns()
// ---------------------------------------------------------------------------

export type SchedulerResult = {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  notifications: ScheduledRunNotification[];
};

// ---------------------------------------------------------------------------
// Schedule input — for creating new schedules
// ---------------------------------------------------------------------------

export type CreateScheduleInput = {
  organizationId: string;
  cloudAccountId: string;
  frequency: ScheduleFrequency;
  timezone?: string;
};
