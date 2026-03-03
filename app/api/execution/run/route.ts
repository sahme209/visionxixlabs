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
import { getExecutionPlugin } from "@/lib/plugins/executionRegistry";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { logAudit } from "@/lib/security/auditLog";
import { generateEnvironmentSummary } from "@/lib/axiom/environmentSummaryGenerator";
import { buildArchitectureGraph } from "@/lib/cloud/architectureGraph";

// Register AWS execution plugins
import "@/lib/plugins/aws";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let userId: string;
    let userPlan: string | null = null;
    let leadId: string | undefined;

    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as { id?: string }).id) {
      userId = (session.user as { id: string }).id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
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
        select: { plan: true },
      });
      userPlan = user?.plan ?? null;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entitlements = getEntitlementsFromPlan(userPlan);
    if (!entitlements.axiomExecution) {
      return NextResponse.json(
        { error: "Scale or Enterprise plan required for execution. Upgrade at /visionxix-ai/pricing" },
        { status: 403 }
      );
    }

    const pluginId = String(body?.pluginId ?? "").trim();
    const input = (body?.input && typeof body.input === "object") ? body.input : {};
    // IAM scan is read-only: always dryRun. Remediation: default dryRun, require apply=true to execute.
    let dryRun = body?.dryRun !== false;
    if (pluginId === "aws:iam-exposure-scan" || pluginId === "aws:iam-readonly-scan") {
      dryRun = true;
    } else if (pluginId === "aws:infra-discovery") {
      dryRun = true;
    } else if (pluginId === "aws:disable-unused-access-key" && body?.apply === true) {
      dryRun = false;
    }

    if (!pluginId) {
      return NextResponse.json({ error: "pluginId required" }, { status: 400 });
    }

    const plugin = getExecutionPlugin(pluginId);
    const confirmation = String(body?.confirmation ?? "").trim();
    const userConfirmedApply =
      plugin?.modifiesInfrastructure && !dryRun
        ? confirmation.toUpperCase().includes("CONFIRM APPLY")
        : undefined;
    if (plugin?.modifiesInfrastructure && !dryRun && !userConfirmedApply) {
      return NextResponse.json(
        {
          error:
            "Infrastructure-modifying actions require explicit confirmation. Run in dry-run mode first to see the plan, then pass confirmation: \"CONFIRM APPLY\" to apply.",
        },
        { status: 400 }
      );
    }

    // AWS plugins require linked connector with verified account
    const awsPlugins = ["aws:iam-exposure-scan", "aws:iam-readonly-scan", "aws:disable-unused-access-key", "aws:infra-discovery"];
    if (awsPlugins.includes(pluginId) && leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { fullPayload: true },
      });
      const payload = (lead?.fullPayload as Record<string, unknown>) || {};
      const connectors = (payload.connectors as Record<string, Record<string, unknown>>) || {};
      const aws = connectors.aws;
      const awsStatus = (aws?.status as string) ?? "pending";
      const verifiedAccountId = (aws?.verifiedAccountId as string) ?? "";
      if (awsStatus !== "linked" || !verifiedAccountId?.trim()) {
        return NextResponse.json(
          { error: "AWS not connected. Link and verify your AWS account in Connectors first." },
          { status: 400 }
        );
      }
    }

    const result = await executePlugin({
      pluginId,
      input,
      ctx: {
        userId,
        leadId,
        dryRun,
        userPlan,
        credentialsKey: leadId ?? undefined,
        userConfirmedApply: userConfirmedApply || undefined,
      },
    });

    // Audit log for AWS plugins
    if (awsPlugins.includes(pluginId) && leadId && result.status === "success" && result.executionId) {
      const action =
        pluginId === "aws:disable-unused-access-key"
          ? "aws_remediation_disable_key"
          : pluginId === "aws:infra-discovery"
            ? "aws_infra_discovery"
            : "aws_scan_run";
      await logAudit({
        leadId,
        action,
        actor: "user",
        metadata: { executionLogId: result.executionId },
      });
    }

    // Generate and store environment summary after aws:infra-discovery succeeds
    if (pluginId === "aws:infra-discovery" && leadId && result.status === "success" && result.data) {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { fullPayload: true, userId: true },
        });
        if (lead) {
          const payload = (lead.fullPayload as Record<string, unknown>) || {};
          const connectorsRaw = (payload.connectors as Record<string, Record<string, unknown>>) || {};
          const connectors: Record<string, boolean> = {};
          let awsAccountId: string | undefined;
          for (const [k, v] of Object.entries(connectorsRaw)) {
            const status = (v?.status as string) || "pending";
            connectors[k] = status === "linked";
            if (k === "aws" && status === "linked" && v?.verifiedAccountId) {
              awsAccountId = String(v.verifiedAccountId);
            }
          }

          const execWhere = lead.userId
            ? { OR: [{ leadId }, { userId: lead.userId }] }
            : { leadId };
          const iamLogs = await prisma.executionLog.findMany({
            where: {
              ...execWhere,
              pluginId: { in: ["aws:iam-exposure-scan", "aws:iam-readonly-scan"] },
              status: "success",
            },
            orderBy: { executedAt: "desc" },
            take: 1,
            select: { result: true },
          });
          const iamResult = iamLogs[0]?.result as Record<string, unknown> | undefined;
          const iamFindings = (iamResult?.findings as Array<Record<string, unknown>>) ?? [];

          const d = result.data as {
            ec2Count?: number;
            s3Count?: number;
            rdsCount?: number;
            vpcCount?: number;
            region?: string;
          };
          const graph = buildArchitectureGraph({
            ec2Count: d.ec2Count ?? 0,
            s3Count: d.s3Count ?? 0,
            rdsCount: d.rdsCount ?? 0,
            vpcCount: d.vpcCount ?? 0,
            region: d.region,
          });

          const summary = await generateEnvironmentSummary({
            discovery: {
              ec2Count: d.ec2Count ?? 0,
              s3Count: d.s3Count ?? 0,
              rdsCount: d.rdsCount ?? 0,
              vpcCount: d.vpcCount ?? 0,
              region: d.region,
            },
            iamFindings: iamFindings.map((f) => ({
              type: f.type as string | undefined,
              severity: f.severity as string | undefined,
              principal: f.principal as string | undefined,
              detail: f.detail as string | undefined,
              summary: (f as { summary?: string }).summary,
            })),
            connectorStatus: {
              ...connectors,
              awsAccountId,
            },
            userId: lead.userId,
          });

          const updatedPayload = {
            ...payload,
            environmentSummary: summary,
            architectureGraph: graph,
          };
          await prisma.lead.update({
            where: { id: leadId },
            data: { fullPayload: updatedPayload as object },
          });
        }
      } catch (summaryErr) {
        console.error("[execution run] environment summary generation failed:", summaryErr);
        // Non-fatal: plugin succeeded; summary can be retried
      }
    }

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
