/**
 * GET/POST /api/cron/compliance-control-check
 *
 * Vercel cron entry-point. Runs the scheduled compliance control checks
 * (lib/compliance/scheduledControlChecks.ts) and persists one
 * ComplianceControlCheckRun row per check. Bearer CRON_SECRET guard;
 * 503 when the secret is unset (refuses to run as a public endpoint) —
 * same pattern as every other cron route in this codebase.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db";
import { runScheduledControlChecks } from "@/lib/compliance/scheduledControlChecks";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const env = loadAppEnv();
  if (!env.cronSecret) {
    return NextResponse.json({ ok: false, reason: "cron_not_configured", detail: "CRON_SECRET is not set." }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ ok: false, reason: "cron_unauthorized" }, { status: 401 });
  }

  const results = runScheduledControlChecks();
  try {
    await prisma.complianceControlCheckRun.createMany({
      data: results.map((r) => ({ controlId: r.controlId, status: r.status, detail: r.detail })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: "persist_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { checked: results.length, results } });
}
