/**
 * GET /api/axiom/execution-logs?token=XXX&leadId=XXX
 * Returns execution logs for audit and rollback info.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const leadId = req.nextUrl.searchParams.get("leadId");

  let userId: string;
  let resolvedLeadId: string | null = leadId;

  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as { id?: string }).id) {
    userId = (session.user as { id: string }).id;
  } else if (token) {
    const result = verifyStarterToken(token);
    if ("error" in result) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const lead = await prisma.lead.findUnique({
      where: { id: result.leadId },
      select: { userId: true, id: true },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    if (!lead.userId) {
      return NextResponse.json({ error: "Sign in to view execution logs" }, { status: 403 });
    }
    userId = lead.userId;
    resolvedLeadId = lead.id;
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await prisma.executionLog.findMany({
    where: {
      userId,
      ...(resolvedLeadId ? { leadId: resolvedLeadId } : {}),
    },
    orderBy: { executedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      pluginId: l.pluginId,
      status: l.status,
      executedAt: l.executedAt.toISOString(),
      rollbackSteps: l.rollbackSteps,
      error: l.error,
    })),
  });
}
