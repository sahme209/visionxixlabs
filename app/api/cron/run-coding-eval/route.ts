/**
 * GET/POST /api/cron/run-coding-eval — Phase 389.
 *
 * Vercel cron entry-point for the nightly AI coding loop eval suite.
 * Bearer CRON_SECRET, 503 when unset. Skips the actual pipeline call
 * when ANTHROPIC_API_KEY is unset — records the run as all-skipped
 * so the operator sees the schedule fired but nothing burned tokens.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { runEvalSuite } from "@/lib/workforce/eval/runEvalSuite";

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

  const result = await runEvalSuite({
    runKind: "cron_daily",
    triggeredBy: "system:eval_cron",
  });

  return NextResponse.json({
    ok: true,
    ...result,
    completedAt: new Date().toISOString(),
  });
}
