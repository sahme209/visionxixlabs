import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { runFounderAutopilot } from "@/lib/founder/founderAutopilot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> { return handle(request); }
export async function POST(request: NextRequest): Promise<Response> { return handle(request); }

/** Hourly founder autopilot run. Requires the cron secret. */
async function handle(request: NextRequest): Promise<Response> {
  const secret = loadAppEnv().cronSecret;
  if (!secret) return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "cron_unauthorized" }, { status: 401 });
  try {
    const run = await runFounderAutopilot();
    return NextResponse.json({ ok: true, data: { outcome: run.outcome, version: run.version, actions: run.actions.length, proposals: run.proposals.length } });
  } catch { return NextResponse.json({ ok: false, error: "autopilot_unavailable" }, { status: 503 }); }
}
