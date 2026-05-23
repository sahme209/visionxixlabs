/**
 * GET /api/cron/webhook-queue — Phase 395.
 *
 * Vercel-cron-shaped: runs every minute, processes any
 * WebhookDelivery rows whose `nextAttemptAt` has elapsed.
 *
 * Auth: Bearer CRON_SECRET (Vercel cron sets this automatically;
 * any other caller must supply the exact string).
 *
 * Returns a summary of how many rows fired in this invocation. Cron
 * logs in Vercel will surface this so the operator can see queue
 * throughput at a glance.
 */

import { NextResponse, type NextRequest } from "next/server";
import { processWebhookRetryQueue } from "@/lib/webhooks/processWebhookRetryQueue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorizedCron(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  const result = await processWebhookRetryQueue();
  return NextResponse.json({ ok: true, ...result });
}
