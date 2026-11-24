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

import {createHash} from "node:crypto";
import {readGrafanaSignature} from "@/lib/observations/grafanaSignature";
import { NextResponse } from "next/server";
import { findWorkspaceFromWebhookSignature, readMonitoringWebhookConfig, type MonitoringWebhookConfig } from "@/lib/workforce/domains/monitoringWebhookConfig";
import {
  parseWebhookPayload,
  type NormalizedAlert,
} from "@/lib/workforce/domains/monitoringWebhookParsers";
import {
  runWorkloadPerformanceEngineer,
  persistWorkloadPerformanceAnalysis,
} from "@/lib/workforce/domains/workloadPerformanceEngineer";
import {redactPayload} from "@/lib/api/redaction";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const MONITORING_ALERT_TARGET_KIND = "workforce_monitoring_alert";
const MONITORING_RECEIPT_PATH = "/api/webhooks/monitoring";
const MONITORING_ANALYSIS_PATH = MONITORING_RECEIPT_PATH + "#analysis";
const ADMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const ANALYSIS_ESTIMATE_CENTS = 30;

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
  bodyHash: string,
): Promise<{slug: string; status: "stored" | "duplicate" | "superseded"}> {
  const slug = alert.sourceOrder === null ? `${provider}_unsequenced_${bodyHash}` : `${provider}_${alert.alertId}`;
  const payload: string[] = [
    `title|${alert.title}`,
    `description|${alert.description}`,
    `severity|${alert.severity}`,
    `state|${alert.state}`,
    `affected_service|${alert.affectedService}`,
    `provider|${provider}`,
    `received_at|${new Date().toISOString()}`,
  ];
  const sourceOrder = alert.sourceOrder;
  if (sourceOrder) {
    payload.push(`source_started_at|${sourceOrder.startedAt}`, `source_body_sha256|${bodyHash}`);
    if (sourceOrder.resolvedAt) payload.push(`source_resolved_at|${sourceOrder.resolvedAt}`);
  }
  for (const tag of alert.tags) payload.push(`tag|${tag}`);

  return prisma.$transaction(async tx => {
    const receipt = await tx.idempotencyRecord.createMany({
      skipDuplicates: true,
      data: {
        organizationId,
        routePath: MONITORING_RECEIPT_PATH,
        idempotencyKey: provider + "_" + bodyHash,
        requestBodyHash: bodyHash,
        status: "completed",
        expiresAt: new Date(Date.now() + ADMISSION_WINDOW_MS),
      },
    });
    if (receipt.count !== 1) return {slug, status: "duplicate"};
    const key = {
      organizationId_targetKind_targetId: {
        organizationId,
        targetKind: MONITORING_ALERT_TARGET_KIND,
        targetId: slug,
      },
    };
    if (sourceOrder) {
      const recorded = await tx.aiRationaleEnrichment.findUnique({where: key, select: {nextActionsJson: true}});
      const fields = Array.isArray(recorded?.nextActionsJson) ? recorded.nextActionsJson : [];
      const startedAt = fields.find(field => typeof field === "string" && field.startsWith("source_started_at|"));
      const resolvedAt = fields.find(field => typeof field === "string" && field.startsWith("source_resolved_at|"));
      const previousStart = typeof startedAt === "string" ? startedAt.slice("source_started_at|".length) : "";
      const previousEnd = typeof resolvedAt === "string" ? resolvedAt.slice("source_resolved_at|".length) : "";
      if (previousStart > sourceOrder.startedAt ||
          (previousStart === sourceOrder.startedAt && previousEnd >= (sourceOrder.resolvedAt ?? ""))) {
        return {slug, status: "superseded"};
      }
    }
    await tx.aiRationaleEnrichment.upsert({
      where: key,
      create: {
        organizationId,
        targetKind: MONITORING_ALERT_TARGET_KIND,
        targetId: slug,
        narrative: `${alert.state === "resolved" ? "RESOLVED: " : ""}${alert.title} · severity=${alert.severity}${alert.affectedService ? ` · ${alert.affectedService}` : ""}`,
        riskFactorsJson: alert.tags as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: "fallback_rules",
        errorMessage: null,
        modelHint: null,
        engineVersion: "monitoring-alert-v1",
      },
      update: {
        narrative: `${alert.state === "resolved" ? "RESOLVED: " : ""}${alert.title} · severity=${alert.severity}${alert.affectedService ? ` · ${alert.affectedService}` : ""}`,
        nextActionsJson: payload as unknown as string[],
        outcome: "fallback_rules",
      },
    });
    return {slug, status: "stored"};
  }, sourceOrder ? {isolationLevel: "Serializable"} : undefined);
}

async function reserveAnalysis(
  organizationId: string,
  expected: MonitoringWebhookConfig,
  bodyHash: string,
  orderedAlertSlug: string | undefined,
): Promise<string | null> {
  try {
    return await prisma.$transaction(async tx => {
      const config = await readMonitoringWebhookConfig(organizationId, tx);
      if (!config?.enabled || !config.autoAnalyze ||
          config.provider !== expected.provider || config.webhookSecret !== expected.webhookSecret ||
          config.dailyCostCapCents !== expected.dailyCostCapCents) {
        return "monitoring_config_changed";
      }
      if (orderedAlertSlug) {
        const alert = await tx.aiRationaleEnrichment.findUnique({
          where: {organizationId_targetKind_targetId: {organizationId, targetKind: MONITORING_ALERT_TARGET_KIND, targetId: orderedAlertSlug}},
          select: {nextActionsJson: true},
        });
        if (!Array.isArray(alert?.nextActionsJson) || !alert.nextActionsJson.includes(`source_body_sha256|${bodyHash}`)) {
          return "source_event_already_observed_or_superseded";
        }
      }
      if (config.dailyCostCapCents > 0) {
        const since = new Date(Date.now() - ADMISSION_WINDOW_MS);
        const admissions = await tx.idempotencyRecord.count({
          where: {organizationId, routePath: MONITORING_ANALYSIS_PATH, createdAt: {gte: since}},
        });
        if ((admissions + 1) * ANALYSIS_ESTIMATE_CENTS > config.dailyCostCapCents) return "daily_cost_cap_reached";
      }
      // Reserve before inference. An uncertain attempt retains the slot.
      const admitted = await tx.idempotencyRecord.createMany({
        skipDuplicates: true,
        data: {
          organizationId,
          routePath: MONITORING_ANALYSIS_PATH,
          idempotencyKey: expected.provider + "_" + bodyHash,
          requestBodyHash: bodyHash,
          status: "completed",
          expiresAt: new Date(Date.now() + ADMISSION_WINDOW_MS),
        },
      });
      return admitted.count === 1 ? null : "analysis_already_admitted";
    }, {isolationLevel: "Serializable"});
  } catch {
    return "daily_cost_meter_unavailable";
  }
}

export async function POST(req: Request) {
  const correlationId = `monitor_webhook_${Date.now().toString(36)}` as CorrelationId;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "body_read_failed" }, { status: 400 });
  }
  if (bytes.length === 0 || bytes.length > 256_000) {
    return NextResponse.json({ error: "body_size_invalid" }, { status: 400 });
  }
  const rawBody = bytes.toString("utf8");
  const grafana = readGrafanaSignature(req.headers, bytes);
  if (grafana.kind === "invalid") {
    return NextResponse.json({error: "signature_mismatch"}, {status: 401});
  }
  const signature = grafana.kind === "signed" ? grafana.signature : readSignatureHeader(req);
  if (!signature) {
    return NextResponse.json({ error: "signature_missing" }, { status: 401 });
  }
  const match = await findWorkspaceFromWebhookSignature(grafana.kind === "signed" ? grafana.bytes : rawBody, signature);
  if (!match || (grafana.kind === "signed" && match.config.provider !== "grafana")) {
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

  const alert = parseWebhookPayload(config.provider, redactPayload(parsed));
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  let persisted: Awaited<ReturnType<typeof persistAlert>>;
  try {
    persisted = await persistAlert(organizationId, alert, config.provider, bodyHash);
  } catch {
    return NextResponse.json({error: "alert_storage_unavailable"}, {status: 503});
  }
  if (persisted.status === "duplicate") {
    return NextResponse.json({ok: true, duplicate: true, analysisSlug: null, analysisSkipReason: "delivery_already_recorded"});
  }
  if (persisted.status === "superseded") {
    return NextResponse.json({ok: true, alertSlug: persisted.slug, analysisSlug: null, analysisSkipReason: "source_event_already_observed_or_superseded"});
  }
  const alertSlug = persisted.slug;

  // Auto-analyze path. Only fires when:
  //   · config.autoAnalyze is on
  //   · the alert is currently firing (skip resolved/unknown)
  //   · severity is medium or higher (skip info/low to control spend)
  //   · workspace AI credit pool isn't exhausted
  //   · daily cost cap allows it
  let analysisSlug: string | null = null;
  let analysisSkipReason: string | null = null;

  if (alert.sourceOrder === null) {
    analysisSkipReason = "source_event_order_unavailable";
  } else if (!config.autoAnalyze) {
    analysisSkipReason = "auto_analyze_disabled";
  } else if (alert.state !== "firing") {
    analysisSkipReason = "alert_not_firing";
  } else if (alert.severity === "info" || alert.severity === "low") {
    analysisSkipReason = "severity_below_threshold";
  } else {
    let credit: Awaited<ReturnType<typeof checkWorkspaceAICredits>> | null = null;
    try {
      credit = await checkWorkspaceAICredits(organizationId, ANALYSIS_ESTIMATE_CENTS, { failClosedOnUsageReadError: true });
    } catch {
      // Fail closed, not crash: an externally-triggered webhook must
      // still 200 and degrade gracefully, not throw, on a transient
      // usage-read failure — skip auto-analysis for this alert instead
      // of risking a monitoring-provider retry storm on an uncaught 500.
      analysisSkipReason = "ai_credit_meter_unavailable";
    }
    if (credit?.kind === "block") {
      analysisSkipReason = "ai_credits_exhausted";
    } else if (credit) {
      analysisSkipReason = await reserveAnalysis(organizationId, config, bodyHash, alert.sourceOrder ? alertSlug : undefined);
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

  const analysisOutcome: "success" | "failure" | "blocked" =
    analysisSkipReason === "analysis_error" ? "failure"
    : analysisSkipReason && ["ai_credits_exhausted", "daily_cost_cap_reached", "daily_cost_meter_unavailable", "ai_credit_meter_unavailable", "monitoring_config_changed"].includes(analysisSkipReason)
      ? "blocked" : "success";

  void auditRecord({
    organizationId: ids.organization(organizationId),
    action: alert.state === "firing" ? "billing.alert_fired" : "engineer.action_attempted",
    outcome: analysisOutcome,
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
