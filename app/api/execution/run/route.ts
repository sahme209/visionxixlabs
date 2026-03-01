/**
 * POST /api/execution/run
 * Server-only. Auth required (session or token with lead.userId).
 * Body: { pluginId, input?, dryRun, token?, leadId? }
 * Returns: { executionId, status, resultSummary }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { executePlugin } from "@/lib/execution/pluginEngine";
import { hasAxiomModule } from "@/lib/userModules";

// Register AWS execution plugins
import "@/lib/plugins/aws";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let userId: string;
    let userModules: unknown = {};
    let userPlan: string | null = null;
    let leadId: string | undefined;

    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as { id?: string }).id) {
      userId = (session.user as { id: string }).id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { modules: true, plan: true },
      });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      userModules = user.modules ?? {};
      userPlan = user.plan ?? null;
    } else if (body?.token) {
      const result = verifyStarterToken(body.token);
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
          { error: "Sign in to run scans. Link your account first." },
          { status: 403 }
        );
      }
      userId = lead.userId;
      leadId = lead.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { modules: true, plan: true },
      });
      userModules = user?.modules ?? {};
      userPlan = user?.plan ?? null;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasAxiomModule(userModules)) {
      return NextResponse.json({ error: "Axiom module required" }, { status: 403 });
    }

    const pluginId = String(body?.pluginId ?? "").trim();
    const input = (body?.input && typeof body.input === "object") ? body.input : {};
    const dryRun = body?.dryRun !== false;

    if (!pluginId) {
      return NextResponse.json({ error: "pluginId required" }, { status: 400 });
    }

    const result = await executePlugin({
      pluginId,
      input,
      ctx: {
        userId,
        leadId,
        dryRun,
        userModules,
        userPlan,
      },
    });

    return NextResponse.json({
      executionId: result.executionId,
      status: result.status,
      resultSummary: result.resultSummary,
      data: result.data,
      error: result.error,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Execution failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
