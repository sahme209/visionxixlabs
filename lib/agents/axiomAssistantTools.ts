/**
 * Axiom Assistant — tools wrapping existing Cloud Operator capabilities.
 * All tools run server-side; no new infrastructure.
 */

import { prisma } from "@/lib/db";
import { executePlugin } from "@/lib/execution/pluginEngine";
import {
  updateEnvironmentAfterDiscovery,
  updateEnvironmentAfterIamScan,
} from "@/lib/cloudOperator/updateEnvironmentAfterDiscovery";
import { isCloudConnectorEnabled } from "@/lib/featureFlags";
import { runCloudOperatorAnalysis } from "@/lib/cloudOperator/triggerCore";
import { buildExportPack } from "@/lib/cloudOperator/buildExportPack";
import { createStarterToken } from "@/lib/starterToken";
import { executiveSummaryEmail } from "@/lib/axiom/emailTemplates";
import { Resend } from "resend";
import { logAudit } from "@/lib/security/auditLog";
import { analyzeArchitecture } from "@/lib/multicloud/architectureAnalyzer";

// Register execution plugins
import "@/lib/plugins/aws";
import "@/lib/plugins/azure/index";
import "@/lib/plugins/gcp/index";
import "@/lib/plugins/github";

export type ToolContext = {
  leadId: string;
  userId?: string | null;
  /** When true, user has said "CONFIRM APPLY" — required for infrastructure-modifying plugins with apply=true */
  userConfirmedApply?: boolean;
};

export type ToolResult = { ok: boolean; data?: Record<string, unknown>; error?: string };

const SYSTEM_USER_ID = process.env.CONTACT_AGENT_USER_ID || "system-axiom-assistant";

/** Connector linking instructions and required fields (does NOT link). */
const LINK_HINTS: Record<string, { instructions: string; requiredFields: string[] }> = {
  github: {
    instructions:
      "Link GitHub: POST /api/connectors/link with connectorType=github, authMethod=token, token=<personal access token>. User must visit Cloud Operator Connectors tab.",
    requiredFields: ["connectorType: github", "token: GitHub PAT with repo scope"],
  },
  aws: {
    instructions:
      "Link AWS: POST /api/connectors/link with connectorType=aws, authMethod=assume-role. Requires roleArn, awsAccountId, externalId (optional). User must create IAM role with trust policy for Axiom.",
    requiredFields: [
      "roleArn: ARN of the IAM role to assume",
      "awsAccountId: 12-digit AWS account ID",
      "externalId: (optional) External ID for trust policy",
    ],
  },
  azure: {
    instructions:
      "Link Azure: POST /api/connectors/link with connectorType=azure. Requires tenantId, clientId, clientSecret, subscriptionId.",
    requiredFields: ["tenantId", "clientId", "clientSecret", "subscriptionId"],
  },
  gcp: {
    instructions:
      "Link GCP: POST /api/connectors/link with connectorType=gcp. Requires projectId, serviceAccountJson.",
    requiredFields: ["projectId", "serviceAccountJson: JSON key file content"],
  },
};

/**
 * Get connector status for a lead.
 */
export async function getConnectorStatus(ctx: ToolContext): Promise<ToolResult> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId } });
    if (!lead) return { ok: false, error: "Lead not found" };

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const connectors = (payload.connectors as Record<string, Record<string, unknown>>) || {};

    const status: Record<string, { status: string; linkedAt?: string; verifiedAccountId?: string }> = {};
    for (const [k, v] of Object.entries(connectors)) {
      const meta = v ?? {};
      let s = (meta.status as string) || "pending";
      if (k === "aws" || k === "azure" || k === "gcp") {
        if (!isCloudConnectorEnabled(k as "aws" | "azure" | "gcp")) s = "unavailable";
      }
      const entry: { status: string; linkedAt?: string; verifiedAccountId?: string } = {
        status: s,
        linkedAt: meta.linkedAt as string | undefined,
      };
      if (k === "aws" && s === "linked" && meta.verifiedAccountId) {
        entry.verifiedAccountId = String(meta.verifiedAccountId);
      }
      status[k] = entry;
    }

    return { ok: true, data: { connectors: status } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to fetch connector status" };
  }
}

/**
 * Return instructions and required fields for linking a connector. Does NOT link.
 */
export function linkConnectorHint(connectorType?: string): ToolResult {
  if (connectorType && connectorType in LINK_HINTS) {
    const hint = LINK_HINTS[connectorType as keyof typeof LINK_HINTS];
    return { ok: true, data: { connectorType, ...hint } };
  }
  return {
    ok: true,
    data: {
      availableConnectors: Object.keys(LINK_HINTS),
      hint: "Ask which connector (github, aws, azure, gcp) the user wants to link.",
    },
  };
}

/**
 * Run Axiom Cloud Operator analysis (trigger).
 */
export async function runAxiomAnalysis(ctx: ToolContext): Promise<ToolResult> {
  try {
    const result = await runCloudOperatorAnalysis(ctx.leadId);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Analysis failed" };
  }
}

/**
 * Run an execution plugin (IAM scan, disable key, etc.).
 * Default dryRun=true; apply=true required for non–read-only actions.
 */
export async function runExecutionPlugin(
  ctx: ToolContext,
  pluginId: string,
  input: Record<string, unknown>,
  options: { dryRun?: boolean; apply?: boolean }
): Promise<ToolResult> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId } });
    if (!lead) return { ok: false, error: "Lead not found" };

    const userId = ctx.userId ?? lead.userId ?? SYSTEM_USER_ID;
    const userPlan = lead.userId
      ? (await prisma.user.findUnique({ where: { id: lead.userId }, select: { plan: true } }))?.plan ?? null
      : null;

    let dryRun = options.dryRun ?? true;
    if (pluginId === "aws:iam-exposure-scan" || pluginId === "aws:infra-discovery" || pluginId === "aws:cost-explorer-summary" || pluginId === "aws:s3-public-bucket-scan") {
      dryRun = true; // always read-only
    } else if (pluginId === "aws:disable-unused-access-key" && options.apply === true) {
      dryRun = false;
    }

    const result = await executePlugin({
      pluginId,
      input: input ?? {},
      ctx: {
        userId,
        leadId: ctx.leadId,
        dryRun,
        userPlan,
        credentialsKey: ctx.leadId,
        userConfirmedApply: ctx.userConfirmedApply,
      },
    });

    // Update environment summary and architecture graph after infra-discovery
    if (
      pluginId === "aws:infra-discovery" &&
      result.status === "success" &&
      result.data &&
      typeof result.data === "object"
    ) {
      const d = result.data as {
        ec2Count?: number;
        s3Count?: number;
        rdsCount?: number;
        vpcCount?: number;
        region?: string;
      };
      await updateEnvironmentAfterDiscovery(ctx.leadId, d);
    }

    // Refresh architecture graph with latest IAM findings after IAM scan
    if (
      pluginId === "aws:iam-exposure-scan" &&
      result.status === "success"
    ) {
      await updateEnvironmentAfterIamScan({
        leadId: ctx.leadId,
        userId: ctx.userId ?? lead?.userId,
      });
    }

    return {
      ok: result.status === "success",
      data: {
        executionId: result.executionId,
        status: result.status,
        resultSummary: result.resultSummary,
        error: result.error,
        dryRun,
        // Include structured result for chat display (findings, counts, etc.)
        ...(result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {}),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Plugin execution failed" };
  }
}

/**
 * Fetch execution history for a lead.
 */
export async function fetchExecutionHistory(ctx: ToolContext): Promise<ToolResult> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: ctx.leadId },
      select: { id: true, userId: true, source: true },
    });

    if (!lead || lead.source !== "cloud-operator") {
      return { ok: false, error: "Lead not found or invalid source" };
    }

    const logs = await prisma.executionLog.findMany({
      where: lead.userId
        ? { OR: [{ leadId: lead.id }, { userId: lead.userId }] }
        : { leadId: lead.id },
      orderBy: { executedAt: "desc" },
      take: 100,
      select: {
        id: true,
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
        summary = `Users: ${s.usersCount ?? 0}, Roles: ${s.rolesCount ?? 0}, Findings: ${s.findingsCount ?? 0}`;
      } else if (log.errorMessage) {
        summary = log.errorMessage;
      } else {
        summary = `${log.pluginId} — ${log.status}`;
      }
      return {
        id: log.id,
        pluginId: log.pluginId,
        status: log.status,
        dryRun: log.dryRun,
        executedAt: log.executedAt,
        summary,
      };
    });

    return { ok: true, data: { entries } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to fetch execution history" };
  }
}

/**
 * Generate and send executive report email.
 */
export async function generateAndSendReport(ctx: ToolContext): Promise<ToolResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Email not configured" };

  try {
    const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId } });
    if (!lead || lead.source !== "cloud-operator") {
      return { ok: false, error: "Lead not found or invalid source" };
    }

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const axiomResult = payload.axiomResult as {
      scores?: { infrastructureScore?: number; estimatedAnnualSavings?: number | null; riskExposureLevel?: string };
      driftSignals?: { hasDrift?: boolean };
    } | undefined;
    const scores = axiomResult?.scores ?? {};
    const operatorOutput = payload.operatorOutput as { business?: { recommendedNextAction?: string } } | undefined;

    const snapshots = await prisma.axiomScoreSnapshot.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    const [current, prev] = snapshots;
    const savingsDelta =
      current?.estimatedAnnualSavings != null && prev?.estimatedAnnualSavings != null
        ? current.estimatedAnnualSavings - prev.estimatedAnnualSavings
        : null;
    const riskDelta =
      current?.riskExposureLevel && prev?.riskExposureLevel && current.riskExposureLevel !== prev.riskExposureLevel
        ? `${prev.riskExposureLevel} → ${current.riskExposureLevel}`
        : null;

    const emailContent = executiveSummaryEmail({
      infrastructureScore: scores.infrastructureScore ?? null,
      savingsDelta,
      riskDelta,
      driftDetected: axiomResult?.driftSignals?.hasDrift ?? false,
      topAction: operatorOutput?.business?.recommendedNextAction ?? "Review your 30-day roadmap.",
    });

    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM || "Axiom <onboarding@resend.dev>";
    const { data, error } = await resend.emails.send({
      from,
      to: lead.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (error) return { ok: false, error: "Failed to send email" };

    await logAudit({ leadId: lead.id, action: "agent_report_sent", actor: "system" });
    return { ok: true, data: { emailId: data?.id, to: lead.email } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send report" };
  }
}

/**
 * Build export pack (reuses export logic). Returns success and download URL.
 */
export async function exportPack(ctx: ToolContext): Promise<ToolResult> {
  try {
    const result = await buildExportPack(ctx.leadId);
    if (!result.success) return { ok: false, error: result.error };

    const baseUrl = process.env.NEXTAUTH_URL || "https://visionxixlabs.com";
    const token = createStarterToken(ctx.leadId);
    const downloadUrl = `${baseUrl}/api/cloud-operator/export?token=${encodeURIComponent(token)}`;

    return {
      ok: true,
      data: {
        sizeBytes: result.buffer.length,
        downloadUrl,
        message: "Export pack built. Download from the link or use the Export button on the Cloud Operator page.",
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Export failed" };
  }
}

/**
 * Run multi-cloud resilience analysis. Scans all connected clouds,
 * computes resilience score, generates AI architecture recommendation.
 */
export async function analyzeCloudDependency(ctx: ToolContext): Promise<ToolResult> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId }, select: { userId: true } });
    const userId = ctx.userId ?? lead?.userId ?? SYSTEM_USER_ID;
    const result = await analyzeArchitecture(ctx.leadId, userId);
    return {
      ok: true,
      data: {
        reportId: result.reportId,
        resilienceScore: result.resilienceScore.total,
        grade: result.resilienceScore.grade,
        scoreSummary: result.resilienceScore.summary,
        categories: {
          cloudDependency: result.resilienceScore.categories.cloudDependency.score,
          regionalRedundancy: result.resilienceScore.categories.regionalRedundancy.score,
          backupAndReplication: result.resilienceScore.categories.backupAndReplication.score,
          securityExposure: result.resilienceScore.categories.securityExposure.score,
          monitoringAndRecovery: result.resilienceScore.categories.monitoringAndRecovery.score,
        },
        primaryProvider: result.currentStateSummary.primaryProvider,
        riskCount: result.risks.length,
        topRisks: result.risks.slice(0, 5).map((r) => `[${r.severity}] ${r.description}`),
        recommendedPattern: result.recommendedArchitecture.pattern,
        secondaryProvider: result.recommendedArchitecture.secondaryProvider,
        rto: result.rto,
        rpo: result.rpo,
        additionalMonthlyCost: result.estimatedCostImpact.additionalMonthlyCost,
        nextSteps: result.nextSteps,
        aiAnalysis: result.aiAnalysis,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Analysis failed" };
  }
}

/**
 * Fetch the latest multi-cloud readiness report for a lead.
 */
export async function getReadinessReport(ctx: ToolContext): Promise<ToolResult> {
  try {
    const report = await prisma.multiCloudReadinessReport.findFirst({
      where: { leadId: ctx.leadId },
      orderBy: { createdAt: "desc" },
    });
    if (!report) {
      return { ok: false, error: "No readiness report found. Run 'Analyze Cloud Dependency' first." };
    }
    return {
      ok: true,
      data: {
        reportId: report.id,
        score: report.score,
        rto: report.rto,
        rpo: report.rpo,
        providerSummary: report.providerSummary,
        risks: report.risks,
        recommendations: report.recommendations,
        estimatedCostImpact: report.estimatedCostImpact,
        createdAt: report.createdAt.toISOString(),
        aiAnalysis: report.aiAnalysis,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to fetch report" };
  }
}

/** Map of tool names to executors. */
export const AXIOM_ASSISTANT_TOOLS: Record<
  string,
  (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult> | ToolResult
> = {
  getConnectorStatus: (ctx) => getConnectorStatus(ctx),
  linkConnectorHint: (_, args) => linkConnectorHint(args.connectorType as string | undefined),
  runAxiomAnalysis: (ctx) => runAxiomAnalysis(ctx),
  runExecutionPlugin: (ctx, args) =>
    runExecutionPlugin(ctx, String(args.pluginId ?? ""), (args.input as Record<string, unknown>) ?? {}, {
      dryRun: args.dryRun as boolean | undefined,
      apply: args.apply as boolean | undefined,
    }),
  fetchExecutionHistory: (ctx) => fetchExecutionHistory(ctx),
  generateAndSendReport: (ctx) => generateAndSendReport(ctx),
  exportPack: (ctx) => exportPack(ctx),
  analyzeCloudDependency: (ctx) => analyzeCloudDependency(ctx),
  getReadinessReport: (ctx) => getReadinessReport(ctx),
};
