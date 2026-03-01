/**
 * POST /api/axiom/execute-fixes
 * Execute cloud fix actions via execution engine (with user approval).
 * Supports session OR token (for cloud-operator). Token requires lead.userId.
 * Body: { token?, actions: FixAction[], approvedActionIds: string[], leadId?, projectId? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { executeFixes } from "@/lib/axiom/pluginExecution";
import { hasAxiomModule } from "@/lib/userModules";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, actions: bodyActions, approvedActionIds, leadId, projectId } = body;

    let userId: string;
    let userModules: unknown = {};
    let resolvedLeadId: string | undefined = leadId;

    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as { id?: string }).id) {
      userId = (session.user as { id: string }).id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { modules: true },
      });
      userModules = user?.modules ?? {};
      if (!hasAxiomModule(userModules)) {
        return NextResponse.json({ error: "Axiom module required" }, { status: 403 });
      }
    } else if (token) {
      const result = verifyStarterToken(token);
      if ("error" in result) {
        return NextResponse.json(
          { error: result.error === "expired" ? "Token expired" : "Invalid token" },
          { status: 401 }
        );
      }
      const lead = await prisma.lead.findUnique({
        where: { id: result.leadId },
        select: { userId: true, id: true },
      });
      if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      if (!lead.userId) {
        return NextResponse.json(
          { error: "Sign in to apply fixes. Link your account to execute changes." },
          { status: 403 }
        );
      }
      userId = lead.userId;
      resolvedLeadId = lead.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { modules: true },
      });
      userModules = user?.modules ?? {};
    } else {
      return NextResponse.json({ error: "Unauthorized. Sign in or provide token." }, { status: 401 });
    }

    const actions = bodyActions ?? [];
    const approved = approvedActionIds ?? [];

    if (!Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json({ error: "actions array required" }, { status: 400 });
    }

    const result = await executeFixes({
      userId,
      projectId: projectId ?? resolvedLeadId,
      leadId: resolvedLeadId,
      actions: actions.map((a: { id: string; pluginId: string; action: string; params?: Record<string, unknown>; approvalRequired?: boolean; description?: string; rollbackSteps?: string[] }) => ({
        id: a.id,
        pluginId: a.pluginId,
        action: a.action,
        params: a.params ?? {},
        approvalRequired: a.approvalRequired !== false,
        description: a.description,
        rollbackSteps: a.rollbackSteps,
      })),
      approvedActionIds: approved,
      userModules,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[axiom execute-fixes]", e);
    return NextResponse.json({ error: "Failed to execute fixes" }, { status: 500 });
  }
}
