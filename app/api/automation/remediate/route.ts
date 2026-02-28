/**
 * Cloud Automation: POST /api/automation/remediate?token=
 * Triggers autonomous remediation (cost-idle, drift, etc.).
 * Requires: starter token, linked GitHub connector, Pro+ tier.
 * Body: { remediationType, githubOwner, githubRepo, githubBaseBranch? }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { decryptCredential } from "@/lib/security/credentialVault";
import { logAudit } from "@/lib/security/auditLog";
import { resolveEffectiveOperatorTier, canViewTechnicalOutputs } from "@/lib/cloudOperator/pricing";
import { runAgentLoop } from "@/lib/automation/agentLoop";
import { observeCostIdleResources, planCostIdleResources } from "@/lib/automation/playbooks/costIdleResources";
import { createPullRequest } from "@/lib/connectors/githubWrite";
import type { RemediationType } from "@/lib/automation/remediationTypes";

const SUPPORTED_TYPES: RemediationType[] = ["cost_idle_resources"];

export async function POST(req: NextRequest) {
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

  let body: {
    remediationType?: string;
    githubOwner?: string;
    githubRepo?: string;
    githubBaseBranch?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const remediationType = (body.remediationType ?? "cost_idle_resources") as RemediationType;
  if (!SUPPORTED_TYPES.includes(remediationType)) {
    return NextResponse.json(
      { error: `Unsupported remediationType. Supported: ${SUPPORTED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const githubOwner = body.githubOwner?.trim();
  const githubRepo = body.githubRepo?.trim();
  const githubBase = body.githubBaseBranch?.trim() || "main";

  if (!githubOwner || !githubRepo) {
    return NextResponse.json(
      { error: "githubOwner and githubRepo required for GitHub PR remediation" },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (lead.source !== "cloud-operator") {
    return NextResponse.json({ error: "Remediation only for cloud-operator leads" }, { status: 400 });
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  let userPlan: string | null = null;
  if (lead.userId) {
    const user = await prisma.user.findUnique({ where: { id: lead.userId }, select: { plan: true } });
    userPlan = user?.plan ?? null;
  }
  const tier = resolveEffectiveOperatorTier(payload.tier as string, userPlan);
  if (!canViewTechnicalOutputs(tier)) {
    return NextResponse.json(
      { error: "Growth or higher membership required for autonomous remediation. Upgrade at /visionxix-ai/pricing" },
      { status: 403 }
    );
  }

  const connectors = (payload.connectors as Record<string, { encryptedCredRef?: string }>) || {};
  const ghConn = connectors.github;
  if (!ghConn?.encryptedCredRef) {
    return NextResponse.json(
      { error: "GitHub connector not linked. Link GitHub in Connectors tab first." },
      { status: 400 }
    );
  }

  let ghToken: string;
  try {
    ghToken = decryptCredential(ghConn.encryptedCredRef);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt GitHub credentials" }, { status: 500 });
  }

  const ctx: import("@/lib/automation/agentLoop").AgentContext = {
    leadId: lead.id,
    remediationType,
    connectors: { github: { token: ghToken } },
    fullPayload: payload,
  };

  const baseBranch = `visionxix-remediation-${remediationType}-${Date.now().toString(36)}`;

  const { reports, actResults } = await runAgentLoop({
    context: ctx,
    observe: observeCostIdleResources,
    plan: planCostIdleResources,
    act: async (_ctx, planResult) => {
      const results: import("@/lib/automation/agentLoop").ActResult[] = [];
      for (let i = 0; i < planResult.actions.length; i++) {
        const action = planResult.actions[i];
        const branchName = planResult.actions.length > 1 ? `${baseBranch}-${i}` : baseBranch;
        if (action.actionType === "github_pr" && action.files?.length) {
          const prRes = await createPullRequest({
            token: ghToken,
            owner: githubOwner,
            repo: githubRepo,
            title: action.title,
            body: action.description,
            head: branchName,
            base: githubBase,
            files: action.files,
          });
          results.push({
            success: prRes.success,
            actionId: action.id,
            prUrl: prRes.prUrl,
            prNumber: prRes.prNumber,
            error: prRes.error,
          });
        } else {
          results.push({
            success: false,
            actionId: action.id,
            error: "Manual action or no files — not executed",
          });
        }
      }
      return results;
    },
    report: async (context, phase, data) => ({
      phase,
      success: true,
      summary: `${phase} completed`,
      details: typeof data === "object" ? (data as Record<string, unknown>) : { raw: String(data) },
      timestamp: new Date().toISOString(),
    }),
  });

  await logAudit({
    leadId: lead.id,
    action: "remediation_triggered",
    actor: "user",
    metadata: {
      remediationType,
      reports: reports.length,
      actResults: actResults.map((r) => ({ success: r.success, prUrl: r.prUrl })),
    },
  });

  const prUrl = actResults.find((r) => r.prUrl)?.prUrl;

  return NextResponse.json({
    success: actResults.some((r) => r.success),
    reports,
    actResults,
    prUrl,
  });
}
