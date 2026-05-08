import { prisma } from "@/lib/db";
import type { CloudProvider } from "../cloudSnapshot";
import type {
  AgentTaskType,
  AgentTaskStatus,
  TaskDefinition,
  TaskContext,
  TaskHandlerResult,
  EnqueueTasksInput,
  QueueProcessResult,
} from "./types";
import { getHandler } from "./handlers";

// ---------------------------------------------------------------------------
// Task definitions — retry rules, dependencies, backoff
// ---------------------------------------------------------------------------

const TASK_DEFINITIONS: Record<AgentTaskType, TaskDefinition> = {
  scan_cloud: {
    taskType: "scan_cloud",
    maxAttempts: 3,
    baseDelayMs: 2000,
    dependsOn: [],
  },
  analyze_snapshot: {
    taskType: "analyze_snapshot",
    maxAttempts: 2,
    baseDelayMs: 1000,
    dependsOn: ["scan_cloud"],
  },
  generate_execution_plan: {
    taskType: "generate_execution_plan",
    maxAttempts: 2,
    baseDelayMs: 1000,
    dependsOn: ["analyze_snapshot"],
  },
  generate_terraform: {
    taskType: "generate_terraform",
    maxAttempts: 2,
    baseDelayMs: 1000,
    dependsOn: ["generate_execution_plan"],
  },
  request_approval: {
    taskType: "request_approval",
    maxAttempts: 1,
    baseDelayMs: 500,
    dependsOn: ["generate_execution_plan"],
  },
  apply_action: {
    taskType: "apply_action",
    maxAttempts: 1,
    baseDelayMs: 1000,
    dependsOn: ["request_approval"],
  },
  verify_action: {
    taskType: "verify_action",
    maxAttempts: 3,
    baseDelayMs: 3000,
    dependsOn: ["apply_action"],
  },
  rollback_action: {
    taskType: "rollback_action",
    maxAttempts: 2,
    baseDelayMs: 2000,
    dependsOn: ["apply_action"],
  },
  schedule_next_scan: {
    taskType: "schedule_next_scan",
    maxAttempts: 2,
    baseDelayMs: 500,
    dependsOn: [],
  },
};

export function getTaskDefinition(taskType: AgentTaskType): TaskDefinition {
  return TASK_DEFINITIONS[taskType];
}

// ---------------------------------------------------------------------------
// enqueueTasks — create task records for an agent run
// ---------------------------------------------------------------------------

export async function enqueueTasks(input: EnqueueTasksInput): Promise<string[]> {
  const { agentRunId, provider, taskTypes, inputOverrides } = input;

  const tasks = taskTypes.map((taskType, i) => {
    const def = TASK_DEFINITIONS[taskType];
    return {
      agentRunId,
      taskType: taskType as string,
      status: "pending" as const,
      provider: provider as string,
      sortOrder: i,
      maxAttempts: def.maxAttempts,
      dependsOn: def.dependsOn,
      inputJson: inputOverrides?.[taskType] ?? null,
      idempotencyKey: `${agentRunId}:${taskType}`,
    };
  });

  const created = await prisma.$transaction(
    tasks.map((t) =>
      prisma.axiomAgentTask.upsert({
        where: { idempotencyKey: t.idempotencyKey },
        create: t,
        update: {},
      }),
    ),
  );

  return created.map((t) => t.id);
}

// ---------------------------------------------------------------------------
// processQueue — run all pending tasks for an agent run, in order
//
// STATUS TRANSITIONS:
//   pending → running → completed
//   pending → running → failed  (if attempts < maxAttempts, stays failed for retry)
//   pending → skipped           (if a dependency failed/skipped)
//   completed → completed       (idempotent: re-running a completed task is a no-op)
// ---------------------------------------------------------------------------

export async function processQueue(agentRunId: string): Promise<QueueProcessResult> {
  const start = Date.now();

  const tasks = await prisma.axiomAgentTask.findMany({
    where: { agentRunId },
    orderBy: { sortOrder: "asc" },
  });

  const run = await prisma.axiomAgentRun.findUnique({
    where: { id: agentRunId },
    select: { organizationId: true, userId: true, cloudAccountId: true },
  });

  if (!run) {
    return emptyResult(agentRunId, start);
  }

  const statusMap = new Map<string, AgentTaskStatus>();
  const taskResults: QueueProcessResult["taskResults"] = [];

  for (const task of tasks) {
    const taskType = task.taskType as AgentTaskType;
    const taskStart = Date.now();

    // Already completed — idempotent skip
    if (task.status === "completed") {
      statusMap.set(taskType, "completed");
      taskResults.push({
        taskId: task.id,
        taskType,
        status: "completed",
        attempts: task.attempts,
        errorMessage: null,
        durationMs: 0,
      });
      continue;
    }

    // Already permanently failed or skipped — don't reprocess
    if (task.status === "skipped") {
      statusMap.set(taskType, "skipped");
      taskResults.push({
        taskId: task.id,
        taskType,
        status: "skipped",
        attempts: task.attempts,
        errorMessage: task.errorMessage,
        durationMs: 0,
      });
      continue;
    }

    // Check dependencies
    const deps = (task.dependsOn as string[]) ?? [];
    const depsFailed = deps.some((d) => {
      const s = statusMap.get(d);
      return s === "failed" || s === "skipped";
    });

    if (depsFailed) {
      await updateTaskStatus(task.id, "skipped", null, "Skipped: dependency failed.");
      statusMap.set(taskType, "skipped");
      taskResults.push({
        taskId: task.id,
        taskType,
        status: "skipped",
        attempts: task.attempts,
        errorMessage: "Skipped: dependency failed.",
        durationMs: Date.now() - taskStart,
      });
      continue;
    }

    // Execute with retry
    const result = await executeWithRetry(task.id, {
      taskId: task.id,
      agentRunId,
      provider: task.provider as CloudProvider,
      organizationId: run.organizationId,
      userId: run.userId,
      cloudAccountId: run.cloudAccountId,
      inputJson: task.inputJson as Record<string, unknown> | null,
      attempt: task.attempts,
    }, taskType, task.attempts, task.maxAttempts);

    statusMap.set(taskType, result.status as AgentTaskStatus);
    taskResults.push({
      taskId: task.id,
      taskType,
      status: result.status as AgentTaskStatus,
      attempts: result.attempts,
      errorMessage: result.errorMessage ?? null,
      durationMs: Date.now() - taskStart,
    });
  }

  const completed = taskResults.filter((t) => t.status === "completed").length;
  const failed = taskResults.filter((t) => t.status === "failed").length;
  const skipped = taskResults.filter((t) => t.status === "skipped").length;

  return {
    agentRunId,
    totalTasks: tasks.length,
    completed,
    failed,
    skipped,
    durationMs: Date.now() - start,
    taskResults,
  };
}

// ---------------------------------------------------------------------------
// retryTask — retry a single failed task (called from API or manual trigger)
// ---------------------------------------------------------------------------

export async function retryTask(taskId: string): Promise<TaskHandlerResult> {
  const task = await prisma.axiomAgentTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { run: { select: { organizationId: true, userId: true, cloudAccountId: true } } },
  });

  if (task.status !== "failed") {
    return { status: "skipped", errorMessage: `Cannot retry task with status '${task.status}'.` };
  }

  if (task.attempts >= task.maxAttempts) {
    return { status: "failed", errorMessage: `Max attempts (${task.maxAttempts}) exhausted.` };
  }

  const ctx: TaskContext = {
    taskId: task.id,
    agentRunId: task.agentRunId,
    provider: task.provider as CloudProvider,
    organizationId: task.run.organizationId,
    userId: task.run.userId,
    cloudAccountId: task.run.cloudAccountId,
    inputJson: task.inputJson as Record<string, unknown> | null,
    attempt: task.attempts,
  };

  return executeSingleTask(task.id, ctx, task.taskType as AgentTaskType);
}

// ---------------------------------------------------------------------------
// Internal — execute a single task with retry loop
// ---------------------------------------------------------------------------

async function executeWithRetry(
  taskId: string,
  ctx: TaskContext,
  taskType: AgentTaskType,
  currentAttempts: number,
  maxAttempts: number,
): Promise<{ status: string; attempts: number; errorMessage?: string }> {
  const def = TASK_DEFINITIONS[taskType];
  let attempts = currentAttempts;
  let lastError: string | undefined;

  while (attempts < maxAttempts) {
    ctx.attempt = attempts;
    const result = await executeSingleTask(taskId, ctx, taskType);

    attempts++;

    if (result.status === "completed" || result.status === "skipped") {
      return { status: result.status, attempts };
    }

    lastError = result.errorMessage;

    if (attempts < maxAttempts) {
      const delay = def.baseDelayMs * Math.pow(2, attempts - 1);
      await sleep(delay);
    }
  }

  await updateTaskStatus(taskId, "failed", null, lastError ?? "Max attempts exhausted.");
  return { status: "failed", attempts, errorMessage: lastError };
}

async function executeSingleTask(
  taskId: string,
  ctx: TaskContext,
  taskType: AgentTaskType,
): Promise<TaskHandlerResult> {
  await prisma.axiomAgentTask.update({
    where: { id: taskId },
    data: {
      status: "running",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  const handler = getHandler(taskType);

  try {
    const result = await handler(ctx);

    if (result.status === "completed") {
      await updateTaskStatus(taskId, "completed", result.outputJson ?? null, null);
    } else if (result.status === "skipped") {
      await updateTaskStatus(taskId, "skipped", null, result.errorMessage ?? null);
    } else {
      await updateTaskStatus(taskId, "failed", null, result.errorMessage ?? "Unknown error.");
    }

    return result;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await updateTaskStatus(taskId, "failed", null, errMsg);
    return { status: "failed", errorMessage: errMsg };
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function updateTaskStatus(
  taskId: string,
  status: AgentTaskStatus,
  outputJson: Record<string, unknown> | null,
  errorMessage: string | null,
): Promise<void> {
  const data: Record<string, unknown> = { status, errorMessage };

  if (status === "completed" || status === "skipped" || status === "failed") {
    data.completedAt = new Date();
  }
  if (outputJson) {
    data.outputJson = outputJson;
  }

  await prisma.axiomAgentTask.update({ where: { id: taskId }, data });
}

function emptyResult(agentRunId: string, start: number): QueueProcessResult {
  return {
    agentRunId,
    totalTasks: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    durationMs: Date.now() - start,
    taskResults: [],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
