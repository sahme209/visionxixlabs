/**
 * GET/POST /api/onboarding/cron-reminder
 *
 * Vercel-cron entrypoint that sends a Slack/Teams reminder to every
 * tenant whose onboarding completion is still below 100%. Dedupes
 * per-tenant per-day so re-running the cron the same day is a no-op.
 *
 * Cron schedule: Monday 14:00 UTC (paired with the digest cron).
 */

import { NextResponse, type NextRequest } from "next/server";
import { buildOnboardingChecklist } from "@/lib/onboarding/onboardingChecklist";
import { sendOutboundNotification } from "@/lib/notifications/outboundNotificationLane";
import { loadAppEnv } from "@/lib/config/env";
import { resolveCorrelationId, apiOk } from "@/lib/api";
import type { OrganizationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest)  { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }

async function handle(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  const env = loadAppEnv();

  if (env.cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: { code: "cron.unauthorized", userMessage: "Cron secret mismatch." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
        { status: 401 },
      );
    }
  } else {
    return NextResponse.json(
      { ok: false, error: { code: "cron.not_configured", userMessage: "CRON_SECRET is not set." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 503 },
    );
  }

  const tenantIds = resolveActiveTenantIds();
  if (tenantIds.length === 0) {
    return apiOk(
      { ran: false, summary: "No tenants registered. Set AUTONOMY_SCHEDULER_TENANTS.", outcomes: [] },
      { correlationId, safetyContract: "notification_read_only" },
    );
  }

  const outcomes: Array<{ tenantId: string; sent: boolean; reason?: string; pendingSteps: number; pct: number }> = [];

  for (const tenantId of tenantIds) {
    try {
      // The checklist is a snapshot of process.env so it doesn't vary
      // per-tenant today. It still works as a reminder mechanism — the
      // cron only fires when the deployment itself is incomplete.
      const checklist = buildOnboardingChecklist();
      const pct = Math.round(checklist.completionRatio * 100);
      if (checklist.completionRatio >= 1) {
        outcomes.push({
          tenantId: String(tenantId),
          sent: false,
          reason: "complete:no_reminder_needed",
          pendingSteps: 0,
          pct: 100,
        });
        continue;
      }

      const pending = checklist.steps.filter((s) => s.status !== "complete");
      const today = new Date().toISOString().slice(0, 10);
      const body = [
        `*Axiom onboarding · ${pct}% complete*`,
        ``,
        `Your deployment still has ${pending.length} setup step(s) outstanding:`,
        ``,
        ...pending.slice(0, 5).map((s) => `   • *${s.label}* — ${s.missingHint ?? "see /dashboard/onboarding"}`),
        pending.length > 5 ? `   … +${pending.length - 5} more` : "",
        ``,
        `Open the checklist to wire what's missing.`,
      ].filter(Boolean).join("\n");

      const result = await sendOutboundNotification({
        dedupeKey: `onboarding-reminder:${tenantId}:${today}`,
        kind: "cycle_summary",
        severity: "info",
        tenantId: String(tenantId),
        headline: `Axiom onboarding · ${pct}% complete · ${pending.length} step(s) pending`,
        body,
        safeNextAction: { label: "Open onboarding checklist", href: "/dashboard/onboarding" },
        evidenceRefs: [`checklist:${checklist.generatedAt}`],
      });

      outcomes.push({
        tenantId: String(tenantId),
        sent: result.ok,
        reason: result.reason,
        pendingSteps: pending.length,
        pct,
      });
    } catch (err) {
      outcomes.push({
        tenantId: String(tenantId),
        sent: false,
        reason: err instanceof Error ? err.message.slice(0, 200) : "unknown_error",
        pendingSteps: 0,
        pct: 0,
      });
    }
  }

  return apiOk(
    {
      ran: true,
      summary: `Onboarding reminder fired for ${outcomes.filter((o) => o.sent).length}/${outcomes.length} tenant(s).`,
      outcomes,
    },
    { correlationId, safetyContract: "notification_read_only" },
  );
}

function resolveActiveTenantIds(): OrganizationId[] {
  const raw = process.env.AUTONOMY_SCHEDULER_TENANTS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean) as unknown as OrganizationId[];
}
