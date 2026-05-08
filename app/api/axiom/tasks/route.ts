/**
 * POST /api/axiom/tasks          — enqueue tasks for an agent run
 * GET  /api/axiom/tasks?runId=   — list tasks for a run
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { enqueueTasks, processQueue } from "@/lib/axiom/taskQueue/runner";
import type { AgentTaskType } from "@/lib/axiom/taskQueue/types";

const VALID_TASK_TYPES = new Set<string>([
  "scan_cloud", "analyze_snapshot", "generate_execution_plan",
  "generate_terraform", "request_approval", "apply_action",
  "verify_action", "rollback_action", "schedule_next_scan",
]);

async function authenticate() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) return null;

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
  if (!entitlements.axiomExecution) return null;

  return userId;
}

export async function GET(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }

  const tasks = await prisma.axiomAgentTask.findMany({
    where: { agentRunId: runId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      taskType: true,
      status: true,
      provider: true,
      attempts: true,
      maxAttempts: true,
      errorMessage: true,
      outputJson: true,
      dependsOn: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { agentRunId, provider, organizationId, cloudAccountId, taskTypes, processImmediately } = body;

  if (!agentRunId || typeof agentRunId !== "string") {
    return NextResponse.json({ error: "agentRunId is required" }, { status: 400 });
  }

  if (!provider || !["aws", "azure", "gcp"].includes(provider)) {
    return NextResponse.json({ error: "provider must be aws, azure, or gcp" }, { status: 400 });
  }

  if (!organizationId || typeof organizationId !== "string") {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  if (!cloudAccountId || typeof cloudAccountId !== "string") {
    return NextResponse.json({ error: "cloudAccountId is required" }, { status: 400 });
  }

  if (!Array.isArray(taskTypes) || taskTypes.length === 0) {
    return NextResponse.json({ error: "taskTypes must be a non-empty array" }, { status: 400 });
  }

  const invalid = taskTypes.filter((t: string) => !VALID_TASK_TYPES.has(t));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid task types: ${invalid.join(", ")}` }, { status: 400 });
  }

  try {
    const taskIds = await enqueueTasks({
      agentRunId,
      provider,
      organizationId,
      userId,
      cloudAccountId,
      taskTypes: taskTypes as AgentTaskType[],
    });

    if (processImmediately) {
      const result = await processQueue(agentRunId);
      return NextResponse.json({ taskIds, result });
    }

    return NextResponse.json({ taskIds });
  } catch (e) {
    console.error("[axiom tasks]", e);
    return NextResponse.json({ error: "Failed to enqueue tasks" }, { status: 500 });
  }
}
