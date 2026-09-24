/** POST /api/workforce/monitoring-webhook — Phase 643 config mgmt. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  readMonitoringWebhookConfig,
  writeMonitoringWebhookConfig,
  deleteMonitoringWebhookConfig,
  generateWebhookSecret,
  type WebhookProvider,
} from "@/lib/workforce/domains/monitoringWebhookConfig";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

function parseProvider(raw: string): WebhookProvider {
  if (
    raw === "datadog" || raw === "prometheus_alertmanager" || raw === "pagerduty" ||
    raw === "grafana" || raw === "opsgenie" || raw === "generic"
  ) return raw;
  return "generic";
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const action = s(f.get("action"));
  const correlationId = `monitoring_webhook_cfg_${Date.now().toString(36)}` as CorrelationId;

  if (action === "delete") {
    await deleteMonitoringWebhookConfig(org).catch(() => {});
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "governance.update",
      outcome: "success",
      entityRef: "monitoring-webhook",
      correlationId,
      detail: { action: "monitoring_webhook_deleted" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/monitoring-webhook?notice=deleted", req.url), 303);
  }

  const provider = parseProvider(s(f.get("provider")));
  const enabled = s(f.get("enabled")) !== "false";
  const autoAnalyze = s(f.get("autoAnalyze")) === "true";
  const dailyCostCapCents = Math.max(0, Number(s(f.get("dailyCostCapCents")) || "0"));

  if (action === "rotate") {
    const newSecret = generateWebhookSecret();
    await writeMonitoringWebhookConfig(org, {
      webhookSecret: newSecret,
      provider,
      enabled,
      autoAnalyze,
      dailyCostCapCents,
    });
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "governance.update",
      outcome: "success",
      entityRef: "monitoring-webhook",
      correlationId,
      detail: { action: "monitoring_webhook_secret_rotated" },
    });
    return NextResponse.redirect(
      new URL(`/dashboard/workforce/monitoring-webhook?notice=saved&rotated=1&secret=${encodeURIComponent(newSecret)}`, req.url),
      303,
    );
  }

  // Default = save (creates secret on first run, preserves existing on update).
  const existing = await readMonitoringWebhookConfig(org);
  const webhookSecret = existing?.webhookSecret ?? generateWebhookSecret();
  const firstRun = !existing;
  await writeMonitoringWebhookConfig(org, {
    webhookSecret,
    provider,
    enabled,
    autoAnalyze,
    dailyCostCapCents,
  });
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "governance.update",
    outcome: "success",
    entityRef: "monitoring-webhook",
    correlationId,
    detail: { action: "monitoring_webhook_saved", provider, autoAnalyze, dailyCostCapCents, firstRun },
  });
  if (firstRun) {
    return NextResponse.redirect(
      new URL(`/dashboard/workforce/monitoring-webhook?notice=saved&rotated=1&secret=${encodeURIComponent(webhookSecret)}`, req.url),
      303,
    );
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/monitoring-webhook?notice=saved", req.url), 303);
}
