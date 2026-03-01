/**
 * POST /api/axiom/execute-fixes
 * Execute cloud fix actions via plugin layer (with user approval).
 * Body: { actions: FixAction[], approvedActionIds: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { executeFixes } from "@/lib/axiom/pluginExecution";
import { hasAxiomModule } from "@/lib/userModules";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { modules: true },
    });
    if (!hasAxiomModule(user?.modules)) {
      return NextResponse.json({ error: "Axiom module required" }, { status: 403 });
    }

    const body = await req.json();
    const actions = body.actions ?? [];
    const approvedActionIds = body.approvedActionIds ?? [];
    const projectId = body.projectId ?? undefined;

    if (!Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json({ error: "actions array required" }, { status: 400 });
    }

    const result = await executeFixes({
      userId,
      projectId,
      actions: actions.map((a: { id: string; pluginId: string; action: string; params?: Record<string, unknown>; approvalRequired?: boolean }) => ({
        id: a.id,
        pluginId: a.pluginId,
        action: a.action,
        params: a.params ?? {},
        approvalRequired: a.approvalRequired !== false,
      })),
      approvedActionIds,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[axiom execute-fixes]", e);
    return NextResponse.json({ error: "Failed to execute fixes" }, { status: 500 });
  }
}
