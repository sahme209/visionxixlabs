import type { CloudProvider } from "../cloudSnapshot";

// ---------------------------------------------------------------------------
// Agent task types — mirrors Prisma AgentTaskType enum
// ---------------------------------------------------------------------------

export type AgentTaskType =
  | "scan_cloud"
  | "analyze_snapshot"
  | "generate_execution_plan"
  | "generate_terraform"
  | "request_approval"
  | "apply_action"
  | "verify_action"
  | "rollback_action"
  | "schedule_next_scan";

export type AgentTaskStatus = "pending" | "running" | "completed" | "failed" | "skipped";

// ---------------------------------------------------------------------------
// Task definition — describes how a task type behaves
// ---------------------------------------------------------------------------

export type TaskDefinition = {
  taskType: AgentTaskType;
  maxAttempts: number;
  baseDelayMs: number;
  dependsOn: AgentTaskType[];
};

// ---------------------------------------------------------------------------
// Task context — everything a handler needs to execute
// ---------------------------------------------------------------------------

export type TaskContext = {
  taskId: string;
  agentRunId: string;
  provider: CloudProvider;
  organizationId: string;
  userId: string;
  cloudAccountId: string;
  inputJson: Record<string, unknown> | null;
  attempt: number;
};

// ---------------------------------------------------------------------------
// Task handler result — returned from every handler
// ---------------------------------------------------------------------------

export type TaskHandlerResult = {
  status: "completed" | "failed" | "skipped";
  outputJson?: Record<string, unknown>;
  errorMessage?: string;
};

export type TaskHandler = (ctx: TaskContext) => Promise<TaskHandlerResult>;

// ---------------------------------------------------------------------------
// Queue input — what the caller provides to enqueue tasks
// ---------------------------------------------------------------------------

export type EnqueueTasksInput = {
  agentRunId: string;
  provider: CloudProvider;
  organizationId: string;
  userId: string;
  cloudAccountId: string;
  taskTypes: AgentTaskType[];
  inputOverrides?: Partial<Record<AgentTaskType, Record<string, unknown>>>;
};

// ---------------------------------------------------------------------------
// Queue result — summary after processing
// ---------------------------------------------------------------------------

export type QueueProcessResult = {
  agentRunId: string;
  totalTasks: number;
  completed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  taskResults: Array<{
    taskId: string;
    taskType: AgentTaskType;
    status: AgentTaskStatus;
    attempts: number;
    errorMessage: string | null;
    durationMs: number;
  }>;
};
