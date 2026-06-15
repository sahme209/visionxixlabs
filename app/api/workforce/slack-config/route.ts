/**
 * POST /api/workforce/slack-config — Phase 635.
 *
 * Operator-facing: paste a Slack incoming-webhook URL, optionally
 * pause, optionally set the notification threshold. Form-POST,
 * 303-redirects back to the config page.
 *
 * Accepts an "action=delete" field to clear the config entirely.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  readSlackConfig,
  writeSlackConfig,
  deleteSlackConfig,
  isValidSlackWebhookUrl,
  postSlackMessage,
} from "@/lib/workforce/domains/slackNotify";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const correlationId = `slack_config_${Date.now().toString(36)}` as CorrelationId;
  const action = s(f.get("action"));

  if (action === "delete") {
    await deleteSlackConfig(org).catch(() => {});
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted",
      outcome: "success",
      entityRef: "slack-config",
      correlationId,
      detail: { action: "slack_config_deleted" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/slack-config?deleted=1", req.url), 303);
  }

  if (action === "test") {
    const existing = await readSlackConfig(org);
    if (!existing) {
      return NextResponse.redirect(new URL("/dashboard/workforce/slack-config?test=no_config", req.url), 303);
    }
    const result = await postSlackMessage(
      existing,
      "This is a test message from your visionxixlabs workforce. If you can read this, the webhook is wired correctly.",
      "✅ Workforce digest · test",
    );
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted",
      outcome: result.ok ? "success" : "failure",
      entityRef: "slack-config",
      correlationId,
      detail: { action: "slack_config_tested", result: result.ok ? "ok" : result.error },
    });
    return NextResponse.redirect(
      new URL(`/dashboard/workforce/slack-config?test=${result.ok ? "ok" : encodeURIComponent(result.error ?? "failed")}`, req.url),
      303,
    );
  }

  // Save path.
  const webhookUrl = s(f.get("webhookUrl")).trim();
  const enabledRaw = s(f.get("enabled"));
  const minOutcomeRaw = s(f.get("minOutcome"));
  if (!isValidSlackWebhookUrl(webhookUrl)) {
    return NextResponse.redirect(new URL("/dashboard/workforce/slack-config?error=invalid_webhook_url", req.url), 303);
  }
  const config = {
    webhookUrl,
    enabled: enabledRaw !== "false",
    minOutcome: (minOutcomeRaw === "active" ? "active" : "critical") as "critical" | "active",
  };
  await writeSlackConfig(org, config);
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: "success",
    entityRef: "slack-config",
    correlationId,
    detail: { action: "slack_config_saved", enabled: config.enabled, minOutcome: config.minOutcome },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/slack-config?saved=1", req.url), 303);
}
