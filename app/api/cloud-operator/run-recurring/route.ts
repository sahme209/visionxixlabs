/**
 * POST /api/cloud-operator/run-recurring
 * Cron-compatible endpoint. Scheduled environment monitoring:
 * - daily IAM scan (jobType=iam_scan)
 * - weekly infrastructure discovery (jobType=infra_discovery)
 * Stores results in ExecutionLog. Notifies users if critical findings.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";
import { insertAxiomSnapshot } from "@/lib/axiom/snapshotService";
import { executePlugin } from "@/lib/execution/pluginEngine";
import { criticalFindingsEmail } from "@/lib/axiom/emailTemplates";
import { logAudit } from "@/lib/security/auditLog";

import "@/lib/plugins/aws";

const SYSTEM_USER_ID = process.env.CONTACT_AGENT_USER_ID || "system-recurring";
const IAM_SCAN_PLUGIN = "aws:iam-exposure-scan";
const INFRA_DISCOVERY_PLUGIN = "aws:infra-discovery";

const JOB_PLUGIN: Record<string, string> = {
  iam_scan: IAM_SCAN_PLUGIN,
  infra_discovery: INFRA_DISCOVERY_PLUGIN,
};

function isAwsLinked(payload: Record<string, unknown>): boolean {
  const connectors = (payload.connectors as Record<string, Record<string, unknown>>) || {};
  const aws = connectors.aws;
  const status = (aws?.status as string) ?? "pending";
  const verifiedAccountId = (aws?.verifiedAccountId as string) ?? "";
  return status === "linked" && !!verifiedAccountId?.trim();
}

async function ensureRecurringRecords(leadId: string): Promise<void> {
  const now = new Date();
  const daily = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const weekly = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const existing = await prisma.recurringAnalysis.findMany({
    where: { leadId },
    select: { jobType: true },
  });
  const hasIam = existing.some((r) => r.jobType === "iam_scan");
  const hasInfra = existing.some((r) => r.jobType === "infra_discovery");

  if (!hasIam) {
    await prisma.recurringAnalysis.create({
      data: {
        leadId,
        frequency: "daily",
        jobType: "iam_scan",
        nextRunAt: daily,
        enabled: true,
        updatedAt: now,
      },
    });
  }
  if (!hasInfra) {
    await prisma.recurringAnalysis.create({
      data: {
        leadId,
        frequency: "weekly",
        jobType: "infra_discovery",
        nextRunAt: weekly,
        enabled: true,
        updatedAt: now,
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("cronSecret");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Ensure RecurringAnalysis records exist for cloud-operator leads with AWS linked
  const cloudOpLeads = await prisma.lead.findMany({
    where: { source: "cloud-operator" },
    select: { id: true, fullPayload: true },
    take: 200,
  });
  for (const lead of cloudOpLeads) {
    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    if (isAwsLinked(payload)) {
      await ensureRecurringRecords(lead.id).catch(() => {});
    }
  }

  const due = await prisma.recurringAnalysis.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    take: 100,
    orderBy: { nextRunAt: "asc" },
  });

  let processed = 0;
  let notified = 0;

  for (const ra of due) {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: ra.leadId },
        select: { id: true, email: true, name: true, userId: true, source: true, fullPayload: true },
      });
      if (!lead || lead.source !== "cloud-operator") continue;

      const payload = (lead.fullPayload as Record<string, unknown>) || {};
      if (!isAwsLinked(payload)) continue;

      const userPlan = lead.userId
        ? (await prisma.user.findUnique({ where: { id: lead.userId }, select: { plan: true } }))?.plan ?? null
        : null;
      const userId = lead.userId ?? SYSTEM_USER_ID;

      const pluginId = ra.jobType ? JOB_PLUGIN[ra.jobType] : null;

      if (pluginId) {
        const result = await executePlugin({
          pluginId,
          input: {},
          ctx: {
            userId,
            leadId: lead.id,
            dryRun: true,
            userPlan,
            credentialsKey: lead.id,
          },
        });

        if (result.status === "success" && ra.jobType === "iam_scan" && result.data) {
          const findings = (result.data.findings as Array<{ type?: string; severity?: string; detail?: string }>) ?? [];
          const critical = findings.filter(
            (f) => (f.severity ?? "").toLowerCase() === "critical"
          );
          const high = findings.filter((f) => (f.severity ?? "").toLowerCase() === "high");
          if (critical.length > 0 || high.length > 0) {
            const apiKey = process.env.RESEND_API_KEY;
            if (apiKey) {
              const emailContent = criticalFindingsEmail({
                leadName: lead.name ?? undefined,
                findingsCount: findings.length,
                criticalCount: critical.length,
                highCount: high.length,
                topFindings: [...critical, ...high].slice(0, 10).map((f) => ({
                  type: f.type ?? "Unknown",
                  severity: f.severity ?? "unknown",
                  detail: f.detail ?? "",
                })),
              });
              const resend = new Resend(apiKey);
              const from = process.env.RESEND_FROM || "Axiom <onboarding@resend.dev>";
              const { error } = await resend.emails.send({
                from,
                to: lead.email,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text,
              });
              if (!error) {
                notified++;
                await logAudit({ leadId: lead.id, action: "recurring_critical_alert_sent", actor: "system", metadata: { criticalCount: critical.length, highCount: high.length } });
              }
            }
          }
        }
      } else {
        // Legacy: snapshot-only
        const axiomResult = payload.axiomResult as { scores?: Record<string, unknown> } | undefined;
        const scores = axiomResult?.scores;
        if (scores) {
          const tier = resolveOperatorTier(payload.tier as string);
          await insertAxiomSnapshot({
            leadId: lead.id,
            tier,
            provider: (payload.operatorProfile as Record<string, unknown>)?.hostingProvider as string | null,
            infrastructureScore: scores.infrastructureScore as number | null,
            estimatedAnnualSavings: scores.estimatedAnnualSavings as number | null,
            riskExposureLevel: scores.riskExposureLevel as string | null,
            deploymentFrictionIndex: scores.deploymentFrictionIndex as number | null,
            complexityTier: scores.complexityTier as string | null,
            automationReadinessScore: scores.automationReadinessScore as number | null,
          });
        }
      }

      const intervalMs =
        ra.frequency === "daily"
          ? 24 * 60 * 60 * 1000
          : ra.frequency === "weekly"
            ? 7 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000;
      const nextRun = new Date(Date.now() + intervalMs);

      await prisma.recurringAnalysis.update({
        where: { id: ra.id },
        data: { lastRunAt: now, nextRunAt: nextRun, updatedAt: now },
      });
      processed++;
    } catch (err) {
      console.error("[run-recurring] failed for", ra.id, err);
    }
  }

  // Phase 9: Weekly SalesPipelineSnapshot
  const allCloudOpLeads = await prisma.lead.findMany({
    where: { source: "cloud-operator" },
    take: 500,
  });
  let highUrgencyCount = 0;
  let enterpriseLikelihoodSum = 0;
  let expansionSum = 0;
  let strategicSum = 0;
  let count = 0;
  for (const l of allCloudOpLeads) {
    const payload = (l.fullPayload as Record<string, unknown>) || {};
    const axiomResult = payload.axiomResult as {
      scores?: { strategicReadinessScore?: number };
      dealSignals?: { urgencyLevel: string; enterpriseLikelihood: number; expansionProbability: number };
    } | undefined;
    const ds = axiomResult?.dealSignals;
    if (!ds) continue;
    if (ds.urgencyLevel === "high" || ds.urgencyLevel === "critical") highUrgencyCount++;
    enterpriseLikelihoodSum += ds.enterpriseLikelihood;
    expansionSum += ds.expansionProbability;
    strategicSum += axiomResult?.scores?.strategicReadinessScore ?? 0;
    count++;
  }
  if (count > 0) {
    await prisma.salesPipelineSnapshot.create({
      data: {
        highUrgencyCount,
        enterpriseLikelihoodAvg: enterpriseLikelihoodSum / count,
        expansionProbabilityAvg: expansionSum / count,
        avgStrategicReadiness: strategicSum / count,
      },
    });
  }

  return NextResponse.json({ success: true, processed, notified });
}
