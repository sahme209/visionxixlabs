/**
 * GET/POST /api/notifications/cron-drain-retries
 *
 * Vercel-cron entrypoint that drains the OutboundNotificationRetry
 * queue once per tick. Each pending row older than 5 minutes gets
 * exactly one more send attempt; the row resolves to 'succeeded' or
 * 'failed_terminal'. Cron schedule: `*\/5 * * * *`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { drainRetryQueue } from "@/lib/notifications/outboundRetryQueue";
import { loadAppEnv } from "@/lib/config/env";
import { resolveCorrelationId, apiOk } from "@/lib/api";

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

  const result = await drainRetryQueue({ limit: 50 });
  return apiOk(
    {
      ran: true,
      summary: `Drained ${result.total} pending retry row(s) · ${result.succeeded} recovered · ${result.failedTerminal} terminal.`,
      result,
    },
    { correlationId, safetyContract: "notification_read_only" },
  );
}
