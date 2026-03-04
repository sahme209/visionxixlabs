/**
 * POST /api/cloud-operator/execute-plan
 * Execute an approved DevOps plan. Auth: token (same as chat).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import type { DevOpsPlan, DevOpsPlanStep } from "@/lib/agents/axiomAssistantAgent";
import { executePlugin } from "@/lib/execution/pluginEngine";
import { runCloudOperatorAnalysis } from "@/lib/cloudOperator/triggerCore";
import { updateEnvironmentAfterDiscovery } from "@/lib/cloudOperator/updateEnvironmentAfterDiscovery";
import { generateAndSendReport } from "@/lib/agents/axiomAssistantTools";
import { buildExportPack } from "@/lib/cloudOperator/buildExportPack";
import { createStarterToken } from "@/lib/starterToken";

import "@/lib/plugins/aws";
import "@/lib/plugins/github";

const VALID_PLUGIN_IDS = ["aws:iam-exposure-scan", "aws:disable-unused-access-key", "aws:infra-discovery", "aws:cost-explorer-summary", "aws:s3-public-bucket-scan", "github:create-cicd-pipeline"];
const SYSTEM_USER_ID = process.env.CONTACT_AGENT_USER_ID || "system-axiom-assistant";

function isValidPlan(plan: unknown): plan is DevOpsPlan {
  if (!plan || typeof plan !== "object") return false;
  const p = plan as Record<string, unknown>;
  if (typeof p.goal !== "string" || !Array.isArray(p.steps) || p.steps.length === 0) return false;
  for (const s of p.steps) {
    if (!s || typeof s !== "object") return false;
    const step = s as Record<string, unknown>;
    const action = String(step.action ?? "");
    if (!["run_plugin", "generate_report", "run_analysis", "view_execution_history", "export_report"].includes(action))
      return false;
    if (action === "run_plugin" && (!step.pluginId || !VALID_PLUGIN_IDS.includes(String(step.pluginId))))
      return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  let body: { token?: string; plan?: unknown; confirmation?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const hasConfirmApply = String(body.confirmation ?? "").toUpperCase().includes("CONFIRM APPLY");

  const token = typeof body.token === "string" ? body.token.trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const verifyResult = verifyStarterToken(token);
  if ("error" in verifyResult) {
    return NextResponse.json(
      { error: verifyResult.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  const plan = body.plan;
  if (!isValidPlan(plan)) {
    return NextResponse.json({ error: "Valid plan required (goal and steps)" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: verifyResult.leadId },
    select: { id: true, userId: true, source: true },
  });
  if (!lead || lead.source !== "cloud-operator") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const leadId = lead.id;
  const userId = lead.userId ?? SYSTEM_USER_ID;
  const userPlan = lead.userId
    ? (await prisma.user.findUnique({ where: { id: lead.userId }, select: { plan: true } }))?.plan ?? null
    : null;

  const results: Array<{ step: number; action: string; pluginId?: string; ok: boolean; summary?: string; error?: string }> = [];
  const baseUrl = process.env.NEXTAUTH_URL || "https://visionxixlabs.com";

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i] as DevOpsPlanStep;
    const stepNum = i + 1;

    if (step.action === "run_plugin") {
      const isDestructivePlugin = step.pluginId === "aws:disable-unused-access-key";
      const dryRun = isDestructivePlugin && !hasConfirmApply;
      try {
        const pluginResult = await executePlugin({
          pluginId: step.pluginId,
          input: step.input ?? {},
          ctx: {
            userId,
            leadId,
            dryRun,
            userPlan,
            credentialsKey: leadId,
            userConfirmedApply: isDestructivePlugin && hasConfirmApply ? true : undefined,
          },
        });
        if (
          step.pluginId === "aws:infra-discovery" &&
          pluginResult.status === "success" &&
          pluginResult.data &&
          typeof pluginResult.data === "object"
        ) {
          const d = pluginResult.data as {
            ec2Count?: number;
            s3Count?: number;
            rdsCount?: number;
            vpcCount?: number;
            region?: string;
          };
          await updateEnvironmentAfterDiscovery(leadId, d);
        }
        results.push({
          step: stepNum,
          action: "run_plugin",
          pluginId: step.pluginId,
          ok: pluginResult.status === "success",
          summary: pluginResult.resultSummary,
          error: pluginResult.error,
        });
      } catch (e) {
        results.push({
          step: stepNum,
          action: "run_plugin",
          pluginId: step.pluginId,
          ok: false,
          error: e instanceof Error ? e.message : "Plugin failed",
        });
      }
    } else if (step.action === "generate_report") {
      try {
        const reportResult = await generateAndSendReport({ leadId, userId });
        results.push({
          step: stepNum,
          action: "generate_report",
          ok: reportResult.ok,
          error: reportResult.error,
          summary: reportResult.ok ? "Report sent to email" : undefined,
        });
      } catch (e) {
        results.push({
          step: stepNum,
          action: "generate_report",
          ok: false,
          error: e instanceof Error ? e.message : "Report failed",
        });
      }
    } else if (step.action === "run_analysis") {
      try {
        await runCloudOperatorAnalysis(leadId);
        results.push({ step: stepNum, action: "run_analysis", ok: true, summary: "Analysis triggered" });
      } catch (e) {
        results.push({
          step: stepNum,
          action: "run_analysis",
          ok: false,
          error: e instanceof Error ? e.message : "Analysis failed",
        });
      }
    } else if (step.action === "export_report") {
      try {
        const packResult = await buildExportPack(leadId);
        const downloadToken = createStarterToken(leadId);
        const downloadUrl = `${baseUrl}/api/cloud-operator/export?token=${encodeURIComponent(downloadToken)}`;
        results.push({
          step: stepNum,
          action: "export_report",
          ok: packResult.success,
          summary: packResult.success ? `Download: ${downloadUrl}` : packResult.error,
          error: packResult.success ? undefined : packResult.error,
        });
      } catch (e) {
        results.push({
          step: stepNum,
          action: "export_report",
          ok: false,
          error: e instanceof Error ? e.message : "Export failed",
        });
      }
    } else if (step.action === "view_execution_history") {
      results.push({
        step: stepNum,
        action: "view_execution_history",
        ok: true,
        summary: "View Timeline tab for history",
      });
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({
    goal: plan.goal,
    results,
    success: allOk,
    summary: allOk
      ? `Completed ${results.length} step(s).`
      : `${results.filter((r) => r.ok).length}/${results.length} steps completed.`,
  });
}
