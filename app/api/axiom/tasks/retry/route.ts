/**
 * POST /api/axiom/tasks/retry — retry a single failed task
 *
 * Body: { taskId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { retryTask } from "@/lib/axiom/taskQueue/runner";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
  if (!entitlements.axiomExecution) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { taskId } = body;

  if (!taskId || typeof taskId !== "string") {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  try {
    const result = await retryTask(taskId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[axiom tasks/retry]", e);
    return NextResponse.json({ error: "Retry failed" }, { status: 500 });
  }
}
