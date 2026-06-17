/** POST /api/workforce/integrations/slack-actions — Phase 644 — save Slack action integration. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  isValidSlackWebhookUrl,
  readIntegrationConfig,
  writeIntegrationConfig,
} from "@/lib/workforce/domains/integrationRegistry";
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
  const correlationId = `integration_slack_${Date.now().toString(36)}` as CorrelationId;

  const webhookUrl = s(f.get("webhookUrl")).trim();
  const enabled = s(f.get("enabled")) !== "false";

  if (!isValidSlackWebhookUrl(webhookUrl)) {
    return NextResponse.redirect(
      new URL("/dashboard/workforce/integrations?error=invalid_webhook_url", req.url),
      303,
    );
  }

  const existing = await readIntegrationConfig(org);
  await writeIntegrationConfig(org, {
    github: existing.github,
    slackActions: { enabled, webhookUrl },
  });

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "policy.update",
    outcome: "success",
    entityRef: "integration:slack_actions",
    correlationId,
    detail: { integration: "slack_actions", enabled },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce/integrations?notice=saved", req.url), 303);
}
