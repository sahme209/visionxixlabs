/**
 * GET /api/cloud-operator/environment-status?token=XXX
 * Returns environment status and suggested actions for proactive guidance.
 * Auth: token (same as /api/cloud-operator/status).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { buildAxiomEnvironmentContext } from "@/lib/axiom/contextBuilder";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export type EnvironmentStatusSuggestedAction = {
  id: "run_iam_scan" | "refresh_environment_scan" | "review_security_fixes" | "discover_infrastructure";
  label: string;
  type: "run_plugin" | "view_execution_history" | "run_analysis";
  pluginId?: string;
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  let leadId: string;
  let userId: string | null = null;

  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as { id?: string }).id) {
    userId = (session.user as { id: string }).id;
  }

  if (token) {
    const result = verifyStarterToken(token);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error === "expired" ? "Token expired" : "Invalid token" },
        { status: 401 }
      );
    }
    leadId = result.leadId;
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { source: true, userId: true },
    });
    if (!lead || lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (lead.userId && !userId) userId = lead.userId;
  } else if (userId) {
    const lead = await prisma.lead.findFirst({
      where: { userId, source: "cloud-operator" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json(
        { error: "Token or session required" },
        { status: 401 }
      );
    }
    leadId = lead.id;
  } else {
    return NextResponse.json(
      { error: "Token or session required" },
      { status: 401 }
    );
  }

  try {
    const ctx = await buildAxiomEnvironmentContext({ leadId, userId });

    const hasIamScan = ctx.lastExecutions.some((e) =>
      ["aws:iam-exposure-scan", "aws:iam-readonly-scan"].includes(e.pluginId)
    );
    const hasInfraDiscovery = ctx.lastExecutions.some((e) => e.pluginId === "aws:infra-discovery");

    const lastIamExec = ctx.lastExecutions.find((e) =>
      ["aws:iam-exposure-scan", "aws:iam-readonly-scan"].includes(e.pluginId)
    );
    const lastAxiomExec = ctx.lastExecutions.find((e) => e.pluginId !== "aws:iam-exposure-scan" && e.pluginId !== "aws:iam-readonly-scan");
    const lastScanTimestamp =
      lastIamExec?.executedAt?.toISOString() ?? lastAxiomExec?.executedAt?.toISOString() ?? null;

    const lastScanAgeMs = lastScanTimestamp
      ? Date.now() - new Date(lastScanTimestamp).getTime()
      : Infinity;
    const isScanStale = lastScanAgeMs > TWENTY_FOUR_HOURS_MS;

    const hasRiskyIamFindings =
      ctx.recentFindings.length > 0 ||
      (ctx.axiomScore?.riskExposureLevel &&
        ["high", "critical"].includes(ctx.axiomScore.riskExposureLevel.toLowerCase()));

    const suggestedActions: EnvironmentStatusSuggestedAction[] = [];

    if (ctx.connectors.aws && !hasIamScan) {
      suggestedActions.push({
        id: "run_iam_scan",
        label: "Run IAM Scan",
        type: "run_plugin",
        pluginId: "aws:iam-exposure-scan",
      });
    }
    if (ctx.connectors.aws && !hasInfraDiscovery) {
      suggestedActions.push({
        id: "discover_infrastructure",
        label: "Discover Infrastructure",
        type: "run_plugin",
        pluginId: "aws:infra-discovery",
      });
    }

    if (isScanStale || (!hasIamScan && !ctx.axiomScore)) {
      suggestedActions.push({
        id: "refresh_environment_scan",
        label: "Refresh Environment Scan",
        type: "run_analysis",
      });
    }

    if (hasRiskyIamFindings) {
      suggestedActions.push({
        id: "review_security_fixes",
        label: "Review Security Fixes",
        type: "view_execution_history",
      });
    }

    return NextResponse.json({
      connectors: ctx.connectors,
      lastScanTimestamp,
      hasIamScan,
      axiomScore: ctx.axiomScore,
      suggestedActions,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to load environment status" },
      { status: 500 }
    );
  }
}
