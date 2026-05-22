/**
 * GET/POST /api/cron/check-billing-alerts — Phase 385.
 *
 * Vercel cron entry-point. Walks every workspace with activity this
 * month and fires any 70/90/100% threshold alerts that haven't fired
 * yet. Idempotent — re-running yields zero rows once thresholds are
 * already in the BillingAlert table for the period.
 *
 * Bearer CRON_SECRET guard; 503 when unset.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { scanBillingAlerts } from "@/lib/billing/scanBillingAlerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const env = loadAppEnv();
  if (!env.cronSecret) {
    return NextResponse.json(
      { ok: false, reason: "cron_not_configured", detail: "CRON_SECRET is not set." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ ok: false, reason: "cron_unauthorized" }, { status: 401 });
  }

  const result = await scanBillingAlerts();
  return NextResponse.json({
    ok: true,
    ...result,
    scannedAt: new Date().toISOString(),
  });
}
