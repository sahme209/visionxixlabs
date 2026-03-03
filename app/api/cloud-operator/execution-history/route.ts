/**
 * GET /api/cloud-operator/execution-history?token=XXX
 * Returns ExecutionLog entries for this lead (read-only).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: result.leadId },
      select: { id: true, userId: true, source: true },
    });

    if (!lead || lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const logs = await prisma.executionLog.findMany({
      where: lead.userId
        ? { OR: [{ leadId: lead.id }, { userId: lead.userId }] }
        : { leadId: lead.id },
      orderBy: { executedAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        pluginId: true,
        status: true,
        dryRun: true,
        executedAt: true,
        result: true,
        errorMessage: true,
      },
    });

    const entries = logs.map((log) => {
      const resultObj = (log.result as Record<string, unknown>) ?? {};
      let summary: string;
      if (typeof resultObj.summary === "string") {
        summary = resultObj.summary;
      } else if (typeof resultObj.action === "string") {
        summary = resultObj.action;
      } else if (resultObj.summary && typeof resultObj.summary === "object") {
        const s = resultObj.summary as Record<string, unknown>;
        const u = Number(s.usersCount ?? 0);
        const r = Number(s.rolesCount ?? 0);
        const f = Number(s.findingsCount ?? 0);
        summary = `Users: ${u}, Roles: ${r}, Findings: ${f}`;
      } else if (log.errorMessage) {
        summary = log.errorMessage;
      } else {
        summary = `${log.pluginId} — ${log.status}`;
      }
      return {
        id: log.id,
        action: log.action,
        pluginId: log.pluginId,
        status: log.status,
        dryRun: log.dryRun,
        executedAt: log.executedAt,
        summary,
      };
    });

    return NextResponse.json({ entries });
  } catch (e) {
    console.error("[cloud-operator execution-history]", e);
    return NextResponse.json({ error: "Failed to fetch execution history" }, { status: 500 });
  }
}
