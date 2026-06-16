/**
 * POST /api/webhooks/monitoring — Phase 643.
 *
 * Generic monitoring-webhook ingestion. Customer's alerting tool
 * (Datadog / Prometheus AlertManager / PagerDuty / Grafana /
 * Opsgenie / generic) sends an HMAC-signed JSON payload. We:
 *
 *   1. Read raw body
 *   2. Read the X-Webhook-Signature header (or provider-specific
 *      variant — most tools accept it as override)
 *   3. Scan workspaces for one whose webhook_secret produces a
 *      matching HMAC — that's how we identify the workspace
 *      without a NextAuth session
 *   4. Parse the payload via the matched workspace's configured
 *      provider parser → NormalizedAlert
 *   5. Persist the normalized alert as one
 *      AiRationaleEnrichment row at targetKind=
 *      workforce_monitoring_alert, targetId=<alertId>
 *   6. If autoAnalyze=true AND the daily cost cap isn't exceeded:
 *      fire workload_performance_engineer against the alert
 *      description (the alert IS the telemetry snapshot from the
 *      customer's perspective). Result links back to the alert.
 *
 * Authentication is HMAC-only — no NextAuth. The signature
 * verification + cost gate + daily cap together prevent abuse.
 */

import { NextResponse } from "next/server";
import {
  findWorkspaceFromWebhookSignature,
  MONITORING_WEBHOOK_TARGET_KIND,
} from "@/lib/workforce/domains/monitoringWebhookConfig";
import {
  parseWebhookPayload,
  type NormalizedAlert,
} from "@/lib/workforce/domains/monitoringWebhookParsers";
import {
  runWorkloadPerformanceEngineer,
  persistWorkloadPerformanceAnalysis,
  WORKLOAD_PERFORMANCE_TARGET_KIND,
} from "@/lib/workforce/domains/workloadPerformanceEngineer";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

export const MONITORING_ALERT_TARGET_KIND = "workforce_monitoring_alert";

function readSignatureHeader(req: Request): string {
  // Order of preference — generic header first, provider-specific
  // overrides accepted.
  return (
    req.headers.get("x-webhook-signature") ||
    req.headers.get("x-datadog-signature") ||
    req.headers.get("x-pagerduty-signature") ||
    req.headers.get("x-opsgenie-signature") ||
    req.headers.get("x-hub-signature-256") ||
    ""
  );
}

async function persistAlert(
  organizationId: string,
  alert: NormalizedAlert,
  provider: string,
): Promise<string> {
  const slug = `${provider}_${alert.alertId}`;
  const payload: string[] = [
    `title|${alert.title}`,
    `description|${alert.description}`,
    `severity|${alert.severity}`,
    `state|${alert.state}`,
    `affected_service|${alert.affectedService}`,
    `provider|${provider}`,
    `received_at|${new Date().toISOString()}`,
  ];
  for (const tag of alert.tags) payload.push(`tag|${tag}`);

  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: MONITORING_ALERT_TARGET_KIND,
          targetId: slug,
        },
      },
      create: {
        organizationId,
        targetKind: MONITORING_ALERT_TARGET_KIND,
        targetId: slug,
        narrative: `${alert.state === "resolved" ? "RESOLVED: " : ""}${alert.title} · severity=${alert.severity}${alert.affectedService ? ` · ${alert.affectedService}` : ""}`,
        riskFactorsJson: alert.tags as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: alert.state === "firing" ? "ai_generated" : "fallback_rules",
        errorMessage: null,
        modelHint: null,
        engineVersion: "monitoring-alert-v1",
      },
      update: {
        narrative: `${alert.state === "resolved" ? "RESOLVED: " : ""}${alert.title} · severity=${alert.severity}${alert.affectedService ? ` · ${alert.affectedService}` : ""}`,
        nextActionsJson: payload as unknown as string[],
        outcome: alert.state === "firing" ? "ai_generated" : "fallback_rules",
      },
    });
  } catch (e) {
    console.warn("[monitoring-webhook] alert persist failed:", e instanceof Error ? e.message : e);
  }
  return slug;
}

export async function POST(req: Request) {
  const correlationId = `monitor_webhook_${Date.now().toString(36)}` as CorrelationId;
  const sig = readSignatureHeader(req);
  if (!sig) {
    return NextResponse.json({ error: "signature_missing" }, { status: 401 });
  }
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "body_read_failed" }, { status: 400 });
  }
  if (rawBody.length === 0 || rawBody.length > 256_000) {
    return NextResponse.json({ error: "body_size_invalid" }, { status: 400 });
  }

  const match = await findWorkspaceFromWebhookSignature(rawBody, sig);
  if (!match) {
    return NextResponse.json({ error: "signature_mismatch" }, { status: 401 });
  }
  const { organizationId, config } = match;

  if (!config.enabled) {
    return NextResponse.json({ ok: true, paused: true });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const alert = parseWebhookPayload(config.provider, parsed);
  const alertSlug = await persistAlert(organizationId, alert, config.provider);

  // Auto-analyze path. Only fires when:
  //   · config.autoAnalyze is on
  //   · the alert is currently firing (skip resolved/unknown)
  //   · severity is medium or higher (skip info/low to control spend)
  //   · workspace AI credit pool isn't exhausted
  //   · daily cost cap allows it
  let analysisSlug: string | null = null;
  let analysisSkipReason: string | null = null;

  if (!config.autoAnalyze) {
    analysisSkipReason = "auto_analyze_disabled";
  } else if (alert.state !== "firing") {
    analysisSkipReason = "alert_not_firing";
  } else if (alert.severity === "info" || alert.severity === "low") {
    analysisSkipReason = "severity_below_threshold";
  } else {
    const credit = await checkWorkspaceAICredits(organizationId, 30);
    if (credit.kind === "block") {
      analysisSkipReason = "ai_credits_exhausted";
    } else if (config.dailyCostCapCents > 0) {
      // Check today's auto-analyze spend on the cap.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const todaysCount = await prisma.aiRationaleEnrichment.count({
        where: {
          organizationId,
          targetKind: WORKLOAD_PERFORMANCE_TARGET_KIND,
          updatedAt: { gte: since },
          // narrative contains the auto-analyze marker we add below
          narrative: { contains: "[auto-analyze]" },
        },
      }).catch(() => 0);
      const estimateCents = todaysCount * 30; // 30¢ per analysis estimate
      if (estimateCents >= config.dailyCostCapCents) {
        analysisSkipReason = "daily_cost_cap_reached";
      }
    }
  }

  if (analysisSkipReason === null) {
    try {
      const analysis = await runWorkloadPerformanceEngineer(organizationId, {
        title: `[auto-analyze] ${alert.title}`,
        serviceDescription: alert.affectedService || `Alert from ${config.provider}`,
        telemetrySnapshot: alert.description || alert.rawPayloadSummary,
        baselineExpectations: undefined,
        recentChanges: alert.tags.length > 0 ? `Alert tags: ${alert.tags.join(", ")}` : undefined,
      });
      await persistWorkloadPerformanceAnalysis(organizationId, analysis);
      analysisSlug = analysis.slug || null;
    } catch (e) {
      console.warn("[monitoring-webhook] auto-analyze failed:", e instanceof Error ? e.message : e);
      analysisSkipReason = "analysis_error";
    }
  }

  void auditRecord({
    organizationId: ids.organization(organizationId),
    action: alert.state === "firing" ? "billing.alert_fired" : "engineer.action_attempted",
    outcome: "success",
    entityRef: `monitoring-alert:${alertSlug}`,
    correlationId,
    detail: {
      action: "monitoring_webhook_received",
      provider: config.provider,
      alertSlug,
      severity: alert.severity,
      state: alert.state,
      analysisSlug,
      analysisSkipReason,
    },
  });

  return NextResponse.json({
    ok: true,
    alertSlug,
    analysisSlug,
    analysisSkipReason,
  });
}
