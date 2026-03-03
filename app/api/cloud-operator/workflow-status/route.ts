/**
 * GET /api/cloud-operator/workflow-status?token=XXX
 * Returns guided workflow step statuses for the Workflow Progress Panel.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { buildAxiomEnvironmentContext } from "@/lib/axiom/contextBuilder";

export type WorkflowStepStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";

export type WorkflowStep = {
  id: number;
  label: string;
  status: WorkflowStepStatus;
  action?: { label: string; tab?: string; message?: string };
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
      return NextResponse.json({ error: "Token or session required" }, { status: 401 });
    }
    leadId = lead.id;
  } else {
    return NextResponse.json({ error: "Token or session required" }, { status: 401 });
  }

  try {
    const ctx = await buildAxiomEnvironmentContext({ leadId, userId });

    const connectorsLinked = Object.values(ctx.connectors).some(Boolean);
    const hasInfraDiscovery = ctx.lastExecutions.some((e) => e.pluginId === "aws:infra-discovery");
    const hasIamScan = ctx.lastExecutions.some((e) =>
      e.pluginId === "aws:iam-exposure-scan"
    );
    const hasRemediation = ctx.lastExecutions.some(
      (e) => e.pluginId === "aws:disable-unused-access-key" && e.status === "success"
    );

    const step1Complete = connectorsLinked;
    const step2Complete = hasInfraDiscovery;
    const step3Complete = hasIamScan;
    const step4Complete = hasIamScan;
    const step5Complete = hasRemediation;

    const stepStatuses: WorkflowStepStatus[] = [
      step1Complete ? "COMPLETE" : "IN_PROGRESS",
      step2Complete ? "COMPLETE" : step1Complete ? "IN_PROGRESS" : "NOT_STARTED",
      step3Complete ? "COMPLETE" : step2Complete ? "IN_PROGRESS" : "NOT_STARTED",
      step4Complete ? "COMPLETE" : step3Complete ? "IN_PROGRESS" : "NOT_STARTED",
      step5Complete ? "COMPLETE" : step4Complete ? "IN_PROGRESS" : "NOT_STARTED",
    ];

    const steps: WorkflowStep[] = [
      {
        id: 1,
        label: "Connect Environment",
        status: stepStatuses[0],
        action: !step1Complete ? { label: "Connect", tab: "connectors" } : undefined,
      },
      {
        id: 2,
        label: "Discover Infrastructure",
        status: stepStatuses[1],
        action: !step2Complete && step1Complete ? { label: "Discover", message: "Discover my AWS infrastructure." } : undefined,
      },
      {
        id: 3,
        label: "Analyze Security & Config",
        status: stepStatuses[2],
        action: !step3Complete && step2Complete ? { label: "Run IAM Scan", message: "Run an IAM exposure scan." } : undefined,
      },
      {
        id: 4,
        label: "Review Findings",
        status: stepStatuses[3],
        action: !step4Complete && step3Complete ? { label: "Review", tab: "connectors" } : undefined,
      },
      {
        id: 5,
        label: "Apply Fixes",
        status: stepStatuses[4],
        action: !step5Complete && step4Complete ? { label: "Apply Fixes", tab: "connectors" } : undefined,
      },
    ];

    return NextResponse.json({ steps });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load workflow status" }, { status: 500 });
  }
}
